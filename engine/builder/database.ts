import pg from "pg";
import "dotenv/config";

export type LeadStatus = "new" | "interested" | "building" | "built" | "deployed" | "approved" | "rejected" | "pitched";
export type SiteStatus = "built" | "deployed" | "approved" | "rejected" | "pitched";

export interface LeadRec {
  id: string;
  name: string;
  category: string;
  phone: string;
  email: string;
  status: LeadStatus;
  siteSlug: string | null;
  siteUrl: string | null;
  scanId: string | null;
  createdAt: string;
}

export interface ReplyRec {
  id: number;
  leadId: string | null;
  sender: string;
  subject: string;
  snippet: string;
  positive: number;
  reasons: string;
  seenAt: string;
}

export interface SiteRec {
  slug: string;
  leadId: string | null;
  dir: string;
  status: SiteStatus;
  liveUrl: string | null;
  createdAt: string;
}

export interface ScanRec {
  id: string;
  location: string;
  label: string;
  niche: string;
  radiusKm: number;
  found: number;
  added: number;
  source: string;
  lat: number | null;
  lon: number | null;
  ok: number;
  error: string | null;
  at: string;
}

// Neon connection string — required now that Postgres is the store.
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.warn("[db] DATABASE_URL not set in .env — database calls will fail. Add your Neon connection string.");
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  // Neon URLs carry ?sslmode=require — force TLS for those (Neon requires it);
  // a plain postgres:// URL without a query string is treated as non-TLS.
  ssl:
    DATABASE_URL?.includes("sslmode=require") || DATABASE_URL?.includes("?")
      ? { rejectUnauthorized: false }
      : false,
  max: 5,
});

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      phone TEXT,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      site_slug TEXT,
      site_url TEXT,
      scan_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      location TEXT NOT NULL,
      label TEXT,
      niche TEXT,
      radius_km REAL NOT NULL DEFAULT 3,
      found INTEGER NOT NULL DEFAULT 0,
      added INTEGER NOT NULL DEFAULT 0,
      source TEXT,
      lat REAL,
      lon REAL,
      ok INTEGER NOT NULL DEFAULT 1,
      error TEXT,
      at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS replies (
      id SERIAL PRIMARY KEY,
      lead_id TEXT,
      sender TEXT,
      subject TEXT,
      snippet TEXT,
      positive INTEGER,
      reasons TEXT,
      seen_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sites (
      slug TEXT PRIMARY KEY,
      lead_id TEXT,
      dir TEXT,
      status TEXT NOT NULL DEFAULT 'built',
      live_url TEXT,
      created_at TEXT NOT NULL
    );
  `).then(() => undefined);
  return schemaReady;
}

export async function upsertLead(l: {
  id: string;
  name: string;
  category: string;
  phone: string;
  email: string;
  status?: LeadStatus;
  scanId?: string | null;
}): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO leads (id, name, category, phone, email, status, scan_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT(id) DO UPDATE SET
       name=EXCLUDED.name, category=EXCLUDED.category,
       phone=EXCLUDED.phone, email=EXCLUDED.email,
       scan_id=COALESCE(EXCLUDED.scan_id, leads.scan_id)`,
    [l.id, l.name, l.category, l.phone, l.email, l.status ?? "new", l.scanId ?? null, new Date().toISOString()]
  );
}

export async function setLeadStatus(id: string, status: LeadStatus, siteSlug?: string, siteUrl?: string): Promise<void> {
  await ensureSchema();
  await pool.query(`UPDATE leads SET status=$2, site_slug=$3, site_url=$4 WHERE id=$1`, [
    id,
    status,
    siteSlug ?? null,
    siteUrl ?? null,
  ]);
}

export async function getLeads(): Promise<LeadRec[]> {
  await ensureSchema();
  const { rows } = await pool.query(
    `SELECT id, name, category, phone, email, status, site_slug as "siteSlug", site_url as "siteUrl", scan_id as "scanId", created_at as "createdAt"
     FROM leads ORDER BY created_at DESC`
  );
  return rows as LeadRec[];
}

export async function countLead(id: string): Promise<number> {
  await ensureSchema();
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM leads WHERE id=$1`, [id]);
  return (rows[0]?.n as number) ?? 0;
}

/** Persist a completed scan record so the dashboard can group leads per scan. */
export async function insertScan(
  s: Omit<ScanRec, "ok" | "error" | "lat" | "lon"> & {
    ok?: boolean;
    error?: string | null;
    coords?: { lat: number; lon: number } | null;
  }
): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO scans (id, location, label, niche, radius_km, found, added, source, lat, lon, ok, error, at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT(id) DO UPDATE SET
       found=EXCLUDED.found, added=EXCLUDED.added,
       label=EXCLUDED.label, source=EXCLUDED.source,
       lat=EXCLUDED.lat, lon=EXCLUDED.lon, ok=EXCLUDED.ok, error=EXCLUDED.error`,
    [
      s.id,
      s.location,
      s.label ?? s.location,
      s.niche ?? "",
      s.radiusKm ?? 3,
      s.found ?? 0,
      s.added ?? 0,
      s.source ?? "",
      s.coords?.lat ?? null,
      s.coords?.lon ?? null,
      s.ok ? 1 : 0,
      s.error ?? null,
      s.at,
    ]
  );
}

export async function getScans(): Promise<ScanRec[]> {
  await ensureSchema();
  const { rows } = await pool.query(
    `SELECT id, location, label, niche, radius_km as "radiusKm", found, added, source, lat, lon, ok, error, at
     FROM scans ORDER BY at DESC`
  );
  return rows as ScanRec[];
}

export async function insertReply(r: Omit<ReplyRec, "id" | "seenAt">): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO replies (lead_id, sender, subject, snippet, positive, reasons, seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [r.leadId, r.sender, r.subject, r.snippet, r.positive, r.reasons, new Date().toISOString()]
  );
}

export async function getReplies(): Promise<ReplyRec[]> {
  await ensureSchema();
  const { rows } = await pool.query(
    `SELECT id, lead_id as "leadId", sender, subject, snippet, positive, reasons, seen_at as "seenAt"
     FROM replies ORDER BY seen_at DESC`
  );
  return rows as ReplyRec[];
}

export async function upsertSite(s: { slug: string; leadId: string | null; dir: string; status: SiteStatus; liveUrl?: string }): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO sites (slug, lead_id, dir, status, live_url, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(slug) DO UPDATE SET status=EXCLUDED.status, live_url=EXCLUDED.live_url`,
    [s.slug, s.leadId, s.dir, s.status, s.liveUrl ?? null, new Date().toISOString()]
  );
}

export async function getSite(slug: string): Promise<SiteRec | null> {
  await ensureSchema();
  const { rows } = await pool.query(
    `SELECT slug, lead_id as "leadId", dir, status, live_url as "liveUrl", created_at as "createdAt"
     FROM sites WHERE slug=$1`,
    [slug]
  );
  return (rows[0] as SiteRec) ?? null;
}

export async function getSites(): Promise<SiteRec[]> {
  await ensureSchema();
  const { rows } = await pool.query(
    `SELECT slug, lead_id as "leadId", dir, status, live_url as "liveUrl", created_at as "createdAt"
     FROM sites ORDER BY created_at DESC`
  );
  return rows as SiteRec[];
}

/** Graceful shutdown for the pool (call on process exit). */
export async function closeDb(): Promise<void> {
  await pool.end();
}
