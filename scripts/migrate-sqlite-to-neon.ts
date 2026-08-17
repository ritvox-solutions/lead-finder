/**
 * One-time migration: copy the existing SQLite DB (.data/leadfinder.db) into
 * Neon Postgres. Idempotent (upserts), safe to re-run.
 *
 * Run: npx tsx scripts/migrate-sqlite-to-neon.ts
 * Requires DATABASE_URL in .env (the Neon connection string).
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { join } from "node:path";
import {
  upsertLead,
  insertScan,
  insertReply,
  upsertSite,
} from "../engine/builder/database.js";

const DB_PATH = process.env.LEADFINDER_DB || join(process.cwd(), ".data", "leadfinder.db");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set in .env — add your Neon connection string first.");
    process.exit(1);
  }

  const sqlite = new Database(DB_PATH, { readonly: true });
  const tables = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
    .all() as { name: string }[];
  console.log("SQLite tables:", tables.map((t) => t.name).join(", "));

  // leads
  const leadRows = sqlite
    .prepare(`SELECT id, name, category, phone, email, status, site_slug, site_url, scan_id, created_at FROM leads`)
    .all() as Array<Record<string, unknown>>;
  console.log(`leads: ${leadRows.length}`);
  for (const r of leadRows) {
    await upsertLead({
      id: r.id as string,
      name: (r.name as string) ?? "Unknown",
      category: (r.category as string) ?? "",
      phone: (r.phone as string) ?? "",
      email: (r.email as string) ?? "",
      status: (r.status as any) ?? "new",
      scanId: (r.scan_id as string) ?? null,
    });
  }

  // scans
  const scanRows = sqlite
    .prepare(`SELECT id, location, label, niche, radius_km, found, added, source, lat, lon, ok, error, at FROM scans`)
    .all() as Array<Record<string, unknown>>;
  console.log(`scans: ${scanRows.length}`);
  for (const r of scanRows) {
    await insertScan({
      id: r.id as string,
      location: (r.location as string) ?? "",
      label: (r.label as string) ?? (r.location as string),
      niche: (r.niche as string) ?? "",
      radiusKm: Number(r.radius_km ?? 3),
      found: Number(r.found ?? 0),
      added: Number(r.added ?? 0),
      source: (r.source as string) ?? "",
      coords: r.lat != null && r.lon != null ? { lat: Number(r.lat), lon: Number(r.lon) } : null,
      ok: Number(r.ok ?? 1) === 1,
      error: (r.error as string) ?? null,
      at: (r.at as string) ?? new Date().toISOString(),
    });
  }

  // replies
  const replyRows = sqlite
    .prepare(`SELECT lead_id, sender, subject, snippet, positive, reasons, seen_at FROM replies`)
    .all() as Array<Record<string, unknown>>;
  console.log(`replies: ${replyRows.length}`);
  for (const r of replyRows) {
    await insertReply({
      leadId: (r.lead_id as string) ?? null,
      sender: (r.sender as string) ?? "",
      subject: (r.subject as string) ?? "",
      snippet: (r.snippet as string) ?? "",
      positive: Number(r.positive ?? 0),
      reasons: (r.reasons as string) ?? "",
    });
  }

  // sites
  const siteRows = sqlite
    .prepare(`SELECT slug, lead_id, dir, status, live_url, created_at FROM sites`)
    .all() as Array<Record<string, unknown>>;
  console.log(`sites: ${siteRows.length}`);
  for (const r of siteRows) {
    await upsertSite({
      slug: r.slug as string,
      leadId: (r.lead_id as string) ?? null,
      dir: (r.dir as string) ?? "",
      status: (r.status as any) ?? "built",
      liveUrl: (r.live_url as string) ?? undefined,
    });
  }

  sqlite.close();
  console.log("Migration complete ✓");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
