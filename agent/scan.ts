/**
 * On-demand location + niche scan, decoupled from the agent's automatic loop.
 *
 * Triggered by the dashboard's "Scan" button (forwarded to the agent via the
 * /action.action as `action: "scan"`). The location can be a place name
 * ("Yeshwanthpur, Bangalore") or a literal "lat,lng".
 *
 * Results are written into the same Postgres DB + state the loop uses, so the rest
 * of the pipeline (enrich -> build -> deploy -> approve -> pitch -> replies)
 * treats manual leads exactly like auto-detected ones.
 *
 * Live progress is emitted to the in-memory progress store so the dashboard's
 * Scan console can render the mission in real time.
 */
import { geocodePlace } from "../engine/geocode.js";
import { scanOverpass } from "../engine/scanners/overpass.js";
import { toLeads } from "../engine/export/csv.js";
import { osmTagProvider, googlePlacesProvider, applyEnrichment } from "../engine/enrich/enrich.js";
import { upsertLead, insertScan, countLead } from "../engine/builder/database.js";
import {
  startScanProgress,
  advanceScanProgress,
  pushScanLog,
  finishScanProgress,
  getScanProgress,
} from "./progress.js";

export interface ScanPayload {
  location: string;
  niche?: string;
  radiusKm?: number;
  minScore?: number;
  requestedBy?: string;
}

export interface ScanSummary {
  ok: boolean;
  found: number;
  added: number;
  coords: { lat: number; lon: number } | null;
  label: string;
  niche: string | undefined;
  source: string;
  error?: string;
}

// Avoid overlapping scans (HTTP handler + loop) racing on the same DB.
let scanning = false;

export { getScanProgress };

export async function performScan(payload: ScanPayload): Promise<ScanSummary> {
  const { location, niche = "", radiusKm = 3, minScore = 40 } = payload;
  const startedAt = Date.now();
  const scanId = `scan-${Date.now()}`;

  if (scanning) {
    return { ok: true, found: 0, added: 0, coords: null, label: location, niche, source: "skipped", error: "scan already in progress" };
  }
  scanning = true;
  startScanProgress({ location, niche, radiusKm });

  // Record the scan upfront (so a failed mission still shows in history), then
  // update it with the real counts before returning.
  await insertScan({
    id: scanId,
    location,
    label: location,
    niche,
    radiusKm,
    found: 0,
    added: 0,
    source: "scan",
    at: new Date().toISOString(),
    ok: false,
  });

  try {
    // 1. Geocode
    advanceScanProgress("geocoding", `GEOCODING REGION '${location}'`, 8);
    const geo = await geocodePlace(location);
    pushScanLog("SYS", `Resolved to ${geo.displayName} (${geo.lat.toFixed(5)},${geo.lon.toFixed(5)}) via ${geo.source}`);
    log(`geocoded "${location}" -> ${geo.displayName} (${geo.lat},${geo.lon}) via ${geo.source}`);

    // 2. Overpass query
    advanceScanProgress("querying", `QUERYING OVERPASS · R${radiusKm}KM`, 22);
    pushScanLog("NET", `Overpass query sent (radius ${radiusKm}km${niche ? `, niche "${niche}"` : ""})`);
    const startMs = Date.now();
    const { businesses, totalFound, failedKeys, servedKeys } = await scanOverpass(
      { lat: geo.lat, lon: geo.lon, radiusKm, niche },
      true /* only businesses with no website — the lead premise */
    );

    if (failedKeys > 0) {
      pushScanLog("ERR", `Overpass unreachable — ${failedKeys}/${failedKeys + servedKeys} query group(s) failed (no endpoint responded)`);
      log(`overpass: ${failedKeys}/${failedKeys + servedKeys} key groups failed`);
    }
    if (totalFound === 0 && failedKeys > 0) {
      // Total failure: the mirrors never answered, so "0 found" is not a real
      // result — surface it as a failed mission instead of a clean empty scan.
      // finishScanProgress(false, msg) already pushes the message as an ERR log.
      const msg = `Overpass did not respond (${failedKeys}/${failedKeys + servedKeys} query groups failed). No data returned.`;
      await insertScan({
        id: scanId,
        location,
        niche,
        radiusKm,
        found: 0,
        added: 0,
        source: geo.source,
        label: geo.displayName,
        coords: { lat: geo.lat, lon: geo.lon },
        at: new Date().toISOString(),
        ok: false,
        error: msg,
      });
      finishScanProgress(false, msg);
      return { ok: false, found: 0, added: 0, coords: { lat: geo.lat, lon: geo.lon }, label: geo.displayName, niche, source: geo.source, error: msg };
    }

    advanceScanProgress("filtering", "FILTERING NO-WEBSITE CANDIDATES", 45, (p) => {
      p.found = totalFound;
      p.noWebsite = businesses.length;
    });
    pushScanLog("NET", `Received ${totalFound} POI records — ${businesses.length} without a website`);
    log(`scan done in ${Math.round((Date.now() - startMs) / 1000)}s: ${totalFound} elements (${businesses.length} no-website)`);

    // 3. Enrich
    advanceScanProgress("enriching", `ENRICHING CONTACTS (${businesses.length})`, 62, (p) => {
      p.noWebsite = businesses.length;
    });
    const provider = process.env.GOOGLE_PLACES_KEY ? googlePlacesProvider : osmTagProvider;
    const map = await provider.enrich(businesses);
    pushScanLog("BOT", "Enrichment complete — contacts + emails linked");
    log("enrich done");

    // 4. Score + filter
    advanceScanProgress("scoring", `SCORING LEADS ≥ ${minScore}`, 82);
    const leads = toLeads(
      businesses.map((b) => ({ ...applyEnrichment(b, map.get(b.id)), id: b.id }))
    ).filter((l) => l.score.total >= minScore);
    pushScanLog("BOT", `${leads.length} candidates pass min-score ${minScore}`);
    log(`${leads.length} leads >= score ${minScore} for niche "${niche || "all"}"`);

    // 5. Write
    advanceScanProgress("writing", `WRITING ${leads.length} NEW LEADS`, 88, (p) => {
      p.enriched = businesses.length;
    });
    let added = 0;
    for (const l of leads) {
      const before = await countLead(l.id);
      await upsertLead({ id: l.id, name: l.name, category: l.category, phone: l.phone ?? "", email: l.email ?? "", status: "new", scanId });
      if (before === 0) added++;
    }
    pushScanLog("BOT", `Persisted ${added} new lead(s)`);
    log(`added ${added} new lead(s) (scan took ${Math.round((Date.now() - startedAt) / 1000)}s)`);

    await insertScan({
      id: scanId,
      location,
      niche,
      radiusKm,
      found: leads.length,
      added,
      source: geo.source,
      label: geo.displayName,
      coords: { lat: geo.lat, lon: geo.lon },
      at: new Date().toISOString(),
      ok: true,
    });

    advanceScanProgress("done", "MISSION COMPLETE", 100, (p) => {
      p.found = leads.length;
      p.added = added;
    });
    finishScanProgress(true);

    return {
      ok: true,
      found: leads.length,
      added,
      coords: { lat: geo.lat, lon: geo.lon },
      label: geo.displayName,
      niche,
      source: geo.source,
    };
  } catch (e: any) {
    log(`scan error: ${e.message}`);
    await insertScan({
      id: scanId,
      location,
      niche,
      radiusKm,
      found: 0,
      added: 0,
      source: "error",
      label: location,
      at: new Date().toISOString(),
      ok: false,
      error: e.message,
    });
    finishScanProgress(false, e.message);
    return { ok: false, found: 0, added: 0, coords: null, label: location, niche, source: "error", error: e.message };
  } finally {
    scanning = false;
  }
}

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] [scan] ${msg}`);
}