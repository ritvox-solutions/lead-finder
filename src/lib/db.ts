/**
 * Dashboard-side Postgres (Neon) reader.
 *
 * With DATABASE_URL set, the dashboard reads leads/sites/replies/scans straight
 * from Neon — the source of truth — instead of depending on the agent's HTTP
 * snapshot or GitHub mirror. The agent writes to the same DB, so both sides
 * always agree.
 */
import { neon } from "@neondatabase/serverless";
import type { AppState, Lead, Site, Reply, ScanRecord } from "@/lib/types";

const DATABASE_URL = process.env.DATABASE_URL;

let sql: ReturnType<typeof neon> | null = null;
if (DATABASE_URL) {
  sql = neon(DATABASE_URL);
}

/** True when the dashboard is configured to read from Neon. */
export function neonConfigured(): boolean {
  return !!sql;
}

/**
 * Build the data tables of AppState (leads/sites/replies/scans) directly from
 * Neon. Returns null if Neon isn't configured or the read fails.
 */
export async function readNeonData(): Promise<{
  leads: Record<string, Lead>;
  sites: Record<string, Site>;
  replies: Reply[];
  scans: ScanRecord[];
} | null> {
  if (!sql) return null;
  try {
    const [leadRows, siteRows, replyRows, scanRows] = await Promise.all([
      sql`SELECT id, name, category, phone, email, status, site_slug, site_url, scan_id, created_at FROM leads ORDER BY created_at DESC`.then((r) => r as Record<string, unknown>[]),
      sql`SELECT slug, lead_id, dir, status, live_url, created_at FROM sites ORDER BY created_at DESC`.then((r) => r as Record<string, unknown>[]),
      sql`SELECT id, lead_id, sender, subject, snippet, positive, reasons, seen_at FROM replies ORDER BY seen_at DESC`.then((r) => r as Record<string, unknown>[]),
      sql`SELECT id, location, label, niche, radius_km, found, added, source, lat, lon, ok, error, at FROM scans ORDER BY at DESC`.then((r) => r as Record<string, unknown>[]),
    ]);

    const leads: Record<string, Lead> = {};
    for (const r of leadRows) {
      leads[r.id as string] = {
        id: r.id as string,
        name: r.name as string,
        category: (r.category as string) ?? "other",
        lat: -1,
        lon: -1,
        website: null,
        phone: (r.phone as string) || null,
        email: (r.email as string) || null,
        street: null,
        city: null,
        postcode: null,
        openingHours: null,
        instagram: null,
        facebook: null,
        score: 0,
        reasons: [],
        likelyWebsiteAbsent: true,
        status: (r.status as Lead["status"]) ?? "new",
        siteSlug: (r.site_slug as string) ?? null,
        siteUrl: (r.site_url as string) ?? null,
        scanId: (r.scan_id as string) ?? null,
        createdAt: r.created_at as string,
        updatedAt: r.created_at as string,
      };
    }

    const sites: Record<string, Site> = {};
    for (const r of siteRows) {
      sites[r.slug as string] = {
        slug: r.slug as string,
        leadId: (r.lead_id as string) ?? null,
        dir: (r.dir as string) ?? "",
        status: (r.status as Site["status"]) ?? "built",
        liveUrl: (r.live_url as string) ?? null,
        createdAt: r.created_at as string,
        updatedAt: r.created_at as string,
      };
    }

    const replies: Reply[] = replyRows.map((r) => ({
      id: r.id as number,
      leadId: (r.lead_id as string) ?? null,
      sender: (r.sender as string) ?? "",
      subject: (r.subject as string) ?? "",
      snippet: (r.snippet as string) ?? "",
      positive: (r.positive as number) === 1,
      reasons: (r.reasons as string) ?? "",
      seenAt: r.seen_at as string,
    }));

    const scans: ScanRecord[] = scanRows.map((r) => ({
      id: r.id as string,
      location: r.location as string,
      label: (r.label as string) || (r.location as string),
      niche: (r.niche as string) ?? "",
      radiusKm: Number(r.radius_km ?? 3),
      found: Number(r.found ?? 0),
      added: Number(r.added ?? 0),
      source: (r.source as string) ?? "",
      coords:
        r.lat != null && r.lon != null ? { lat: Number(r.lat), lon: Number(r.lon) } : null,
      at: r.at as string,
      ok: (r.ok as number) === 1,
      error: (r.error as string) ?? undefined,
    }));

    return { leads, sites, replies, scans };
  } catch (e: any) {
    console.warn("[db] Neon read failed:", e.message);
    return null;
  }
}

/** Merge Neon data into a state snapshot (settings/scanProgress come from elsewhere). */
export function withNeonData(base: AppState, data: NonNullable<Awaited<ReturnType<typeof readNeonData>>>): AppState {
  return {
    ...base,
    leads: data.leads,
    sites: data.sites,
    replies: data.replies,
    scans: data.scans,
  };
}
