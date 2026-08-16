import Database from "better-sqlite3";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

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

const DB_PATH = process.env.LEADFINDER_DB ?? join(process.cwd(), ".data", "leadfinder.db");

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;
  const dir = join(process.cwd(), ".data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  dbInstance = new Database(DB_PATH);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      phone TEXT,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      site_slug TEXT,
      site_url TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  `);
  return dbInstance;
}

export function upsertLead(l: {
  id: string;
  name: string;
  category: string;
  phone: string;
  email: string;
  status?: LeadStatus;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO leads (id, name, category, phone, email, status, created_at)
     VALUES (@id, @name, @category, @phone, @email, @status, @createdAt)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, category=excluded.category,
       phone=excluded.phone, email=excluded.email`
  ).run({
    id: l.id,
    name: l.name,
    category: l.category,
    phone: l.phone,
    email: l.email,
    status: l.status ?? "new",
    createdAt: new Date().toISOString(),
  });
}

export function setLeadStatus(id: string, status: LeadStatus, siteSlug?: string, siteUrl?: string): void {
  const db = getDb();
  db.prepare(`UPDATE leads SET status=@status, site_slug=@siteSlug, site_url=@siteUrl WHERE id=@id`).run({
    id,
    status,
    siteSlug: siteSlug ?? null,
    siteUrl: siteUrl ?? null,
  });
}

export function getLeads(): LeadRec[] {
  const db = getDb();
  return db.prepare(`SELECT id, name, category, phone, email, status, site_slug as siteSlug, site_url as siteUrl, created_at as createdAt FROM leads ORDER BY created_at DESC`).all() as LeadRec[];
}

export function insertReply(r: Omit<ReplyRec, "id" | "seenAt">): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO replies (lead_id, sender, subject, snippet, positive, reasons, seen_at)
     VALUES (@leadId, @sender, @subject, @snippet, @positive, @reasons, @seenAt)`
  ).run({ ...r, seenAt: new Date().toISOString() });
}

export function upsertSite(s: { slug: string; leadId: string | null; dir: string; status: SiteStatus; liveUrl?: string }): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO sites (slug, lead_id, dir, status, live_url, created_at)
     VALUES (@slug, @leadId, @dir, @status, @liveUrl, @createdAt)
     ON CONFLICT(slug) DO UPDATE SET status=excluded.status, live_url=excluded.live_url`
  ).run({
    slug: s.slug,
    leadId: s.leadId,
    dir: s.dir,
    status: s.status,
    liveUrl: s.liveUrl ?? null,
    createdAt: new Date().toISOString(),
  });
}

export function getSite(slug: string): SiteRec | null {
  const db = getDb();
  return (db.prepare(`SELECT slug, lead_id as leadId, dir, status, live_url as liveUrl, created_at as createdAt FROM sites WHERE slug=@slug`).get({ slug }) as SiteRec) ?? null;
}