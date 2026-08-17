/**
 * State snapshot + local persistence helpers, shared by the agent loop
 * (agent/index.ts) and the HTTP server (agent/server.ts). Splitting this out
 * avoids a circular import between the two modules.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getLeads, getScans, getSites, getReplies } from "../engine/builder/database.js";
import type { AppState, Lead, Site, Reply, ManualScanInfo, ScanRecord } from "./types.js";
import { getScanProgress } from "./progress.js";

export const STATE_DIR = join(process.cwd(), ".data");
if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
export const LOCAL_STATE = join(STATE_DIR, "agent-state.json");

function now(): string {
  return new Date().toISOString();
}

/** Build an AppState snapshot from the Postgres DB (source of truth on the agent). */
export async function buildState(): Promise<AppState> {
  const dbLeads = await getLeads();
  const leads: Record<string, Lead> = {};
  for (const l of dbLeads) {
    leads[l.id] = {
      id: l.id,
      name: l.name,
      category: l.category,
      lat: -1,
      lon: -1,
      tags: {},
      raw: {},
      website: null,
      phone: l.phone ?? null,
      email: l.email ?? null,
      street: null,
      city: null,
      postcode: null,
      openingHours: null,
      instagram: null,
      facebook: null,
      score: 0,
      reasons: [],
      likelyWebsiteAbsent: true,
      status: l.status,
      siteSlug: l.siteSlug ?? null,
      siteUrl: l.siteUrl ?? null,
      scanId: l.scanId ?? null,
      createdAt: l.createdAt,
      updatedAt: l.createdAt,
    };
  }

  // Pull sites from DB
  const sites: Record<string, Site> = {};
  const siteRows = await getSites();
  for (const r of siteRows) {
    sites[r.slug] = {
      slug: r.slug,
      leadId: r.leadId,
      dir: r.dir,
      status: r.status as any,
      liveUrl: r.liveUrl,
      createdAt: r.createdAt,
      updatedAt: r.createdAt,
    };
  }

  // Replies
  const replyRows = (await getReplies()) as unknown as Reply[];

  // Carry over persisted settings + last scan info from the local state file.
  let lastScanAt = "";
  let lastManualScan: ManualScanInfo | null = null;
  try {
    const raw = readFileSync(LOCAL_STATE, "utf8");
    const parsed = JSON.parse(raw);
    lastScanAt = parsed?.settings?.lastScanAt ?? "";
    lastManualScan = parsed?.settings?.lastManualScan ?? null;
  } catch {}

  // Full scan history (each scan = one sweep, leads tagged with scanId).
  const scans: ScanRecord[] = (await getScans()).map((s) => ({
    id: s.id,
    location: s.location,
    label: s.label ?? s.location,
    niche: s.niche ?? "",
    radiusKm: s.radiusKm,
    found: s.found,
    added: s.added,
    source: s.source ?? "",
    coords: s.lat != null && s.lon != null ? { lat: s.lat, lon: s.lon } : null,
    at: s.at,
    ok: s.ok === 1,
    error: s.error ?? undefined,
  }));

  return {
    version: 1,
    updatedAt: now(),
    settings: {
      scanArea: process.env.SCAN_AREA ?? "51.5074,-0.1278",
      radiusKm: Number(process.env.SCAN_RADIUS_KM ?? 3),
      minScore: Number(process.env.MIN_SCORE ?? 40),
      yourName: process.env.YOUR_NAME ?? "Anikethan",
      yourBusiness: process.env.YOUR_BUSINESS ?? "Webly",
      ownerEmail: process.env.OWNER_EMAIL ?? "shettyanikethand@gmail.com",
      autoScanEnabled: String(process.env.AUTO_SCAN_ENABLED ?? "false") === "true",
      scanIntervalMinutes: Number(process.env.SCAN_INTERVAL_MINUTES ?? 30),
      lastScanAt,
      lastManualScan,
    },
    leads,
    sites,
    replies: replyRows,
    scans,
    pendingActions: [],
    scanProgress: getScanProgress(),
  };
}

/** Save snapshot to local file (for dev + fallback). */
export function saveLocalState(state: AppState) {
  writeFileSync(LOCAL_STATE, JSON.stringify(state, null, 2), "utf8");
}

/** Persist a finished manual-scan summary into settings.lastManualScan. */
export function recordManualScan(state: AppState, info: ManualScanInfo): void {
  state.settings.lastManualScan = info;
  saveLocalState(state);
}
