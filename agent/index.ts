/**
 * Agent — runs on the laptop (always-on machine).
 *
 * Autonomous loop:
 *   1. Read state (from local file + GitHub, merge).
 *   2. If auto-scan enabled and interval elapsed: scan → enrich → store new leads.
 *   3. For each `new` lead with contact info (email or phone): build-site → deploy-site.
 *      Status becomes `deployed` + a preview URL is emailed to the owner.
 *   4. STOP at the approval gate: do NOT pitch until `approved`.
 *   5. Read pending approve/reject actions from GitHub/local; on `approve`:
 *      pitch (email the lead) → status `pitched`.
 *   6. Periodically check-replies (Gmail IMAP) → positive → `interested`.
 *   7. Write state back to local file + push to GitHub for the dashboard to read.
 *
 * Run:        npx tsx agent/index.ts          (or: npm run agent)
 * As a service: see AGENT.md for a systemd unit.
 */
import "dotenv/config";
import { scanOverpass } from "../engine/scanners/overpass.js";
import { toLeads } from "../engine/export/csv.js";
import { osmTagProvider, googlePlacesProvider, applyEnrichment } from "../engine/enrich/enrich.js";
import { generateOutreach } from "../engine/outreach/outreach.js";
import { scaffoldSite } from "../engine/builder/scaffold.js";
import { deployVercel } from "../engine/builder/vercel.js";
import {
  upsertLead,
  setLeadStatus,
  upsertSite,
  getSite,
  getLeads,
} from "../engine/builder/database.js";
import { sendMail } from "../engine/emailer.js";
import { scanInbox } from "../engine/inbox.js";
import { writeState, pullActions } from "./gh.js";
import { startAgentServer, setState } from "./server.js";
import { buildState, saveLocalState, recordManualScan, LOCAL_STATE } from "./state.js";
import { existsSync } from "node:fs";

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

function now(): string {
  return new Date().toISOString();
}

/** Main one-shot cycle. Returns when done; the loop re-invokes it. */
async function runCycle() {
  const state = await buildState();
  saveLocalState(state);

  // 1. Honour pending approve/reject (and any scan) actions from the dashboard.
  const actions = await pullActions();
  for (const a of actions) {
    if (a.action === "scan") {
      // Executed immediately by the HTTP /action handler; this branch is a
      // safety net for the loop-based path. It re-runs performScan.
      log(`scan action: ${a.location ?? "?"} (niche=${a.niche})`);
      try {
        const { performScan } = await import("./scan.js");
        const r = await performScan({
          location: a.location ?? "",
          niche: a.niche,
          radiusKm: a.radiusKm,
          minScore: a.minScore,
        });
        recordManualScan(state, {
          location: a.location ?? "",
          niche: a.niche ?? "",
          radiusKm: a.radiusKm ?? state.settings.radiusKm,
          found: r.found,
          added: r.added,
          label: r.label,
          coords: r.coords,
          source: r.source,
          at: now(),
          ok: r.ok,
          error: r.error,
        });
        log(`  scan finished: ${r.found} found, ${r.added} added`);
      } catch (e: any) {
        log(`  scan action error: ${e.message}`);
      }
      continue;
    }

    log(`action: ${a.action} for ${a.slug}`);
    const site = getSite(a.slug);
    if (!site) {
      log(`  -> no site found for ${a.slug}, skipping`);
      continue;
    }
    if (a.action === "approve") {
      setLeadStatus(site.leadId ?? "", "approved");
      upsertSite({ slug: a.slug, leadId: site.leadId, dir: site.dir, status: "approved", liveUrl: site.liveUrl ?? undefined });
    } else if (a.action === "reject") {
      setLeadStatus(site.leadId ?? "", "rejected");
      upsertSite({ slug: a.slug, leadId: site.leadId, dir: site.dir, status: "rejected", liveUrl: site.liveUrl ?? undefined });
    }
  }

  // 2. Scan if enabled and interval elapsed.
  const lastScan = state.settings.lastScanAt ?? "";
  const elapsedMin = lastScan ? (Date.now() - new Date(lastScan).getTime()) / 60000 : 9999;
  if (state.settings.autoScanEnabled && elapsedMin >= state.settings.scanIntervalMinutes) {
    log(`scanning ${state.settings.scanArea} r=${state.settings.radiusKm}km ...`);
    const [latStr, lonStr] = state.settings.scanArea.split(",");
    const { businesses, totalFound } = await scanOverpass(
      { lat: Number(latStr), lon: Number(lonStr), radiusKm: state.settings.radiusKm },
      true /* only businesses with no website — the lead premise */
    );
    log(`  found ${totalFound} businesses (${businesses.length} no-website)`);

    // Enrich (OSM tags by default; Google Places if key present)
    const provider = process.env.GOOGLE_PLACES_KEY ? googlePlacesProvider : osmTagProvider;
    const map = await provider.enrich(businesses);

    const leads = toLeads(
      businesses.map((b) => ({ ...applyEnrichment(b, map.get(b.id)), id: b.id }))
    ).filter((l) => l.score.total >= state.settings.minScore);

    log(`  ${leads.length} leads ≥ score ${state.settings.minScore}`);
    for (const l of leads) {
      upsertLead({ id: l.id, name: l.name, category: l.category, phone: l.phone ?? "", email: l.email ?? "", status: "new" });
    }

    state.settings.lastScanAt = now();
  }

  // 3. For each `new`/`built` lead with contact, build + deploy + email preview.
  const dbLeads = getLeads();
  for (const l of dbLeads) {
    if (l.status !== "new") continue;
    // Need an email or phone to reach them.
    if (!l.email && !l.phone) {
      log(`lead ${l.name}: skip (no email/phone)`);
      continue;
    }
    log(`building site for ${l.name} (${l.email || l.phone})`);
    try {
      const biz = {
        id: l.id,
        name: l.name,
        lat: -1,
        lon: -1,
        category: l.category as any,
        tags: {},
        website: null,
        phone: l.phone ?? null,
        email: l.email ?? null,
        street: null,
        city: null,
        postcode: null,
        openingHours: null,
        instagram: null,
        facebook: null,
        raw: {},
      };
      setLeadStatus(l.id, "building", undefined);
      const { dir, config } = await scaffoldSite(biz, state.settings.ownerEmail);
      // Build it
      const { execa } = await import("execa");
      log(`  installing deps...`);
      await execa("npm", ["install", "--no-audit", "--no-fund"], { cwd: dir });
      log(`  building Next...`);
      await execa("npm", ["run", "build"], { cwd: dir });

      upsertSite({ slug: config.slug, leadId: l.id, dir, status: "built" });
      setLeadStatus(l.id, "built", config.slug);

      // Deploy to Vercel
      log(`  deploying to Vercel...`);
      const { url } = await deployVercel(dir, config.slug);
      upsertSite({ slug: config.slug, leadId: l.id, dir, status: "deployed", liveUrl: url });
      setLeadStatus(l.id, "deployed", config.slug, url);
      log(`  deployed: ${url}`);

      // Email the owner the preview link
      await sendMail({
        to: state.settings.ownerEmail,
        subject: `Site preview: ${l.name} (${config.slug})`,
        text: `A site has been built for ${l.name}.\n\nPreview: ${url}\n\nApprove: https://leadfinder.vercel.app (or your dashboard URL)\n\nIt will NOT be pitched to the lead until you approve it.`,
      });
      log(`  preview emailed to ${state.settings.ownerEmail}`);
    } catch (e: any) {
      log(`  build/deploy error: ${e.message}`);
      setLeadStatus(l.id, "rejected");
    }
  }

  // 4. Pitch approved leads (email outreach from your Gmail).
  for (const l of dbLeads) {
    if (l.status !== "approved") continue;
    log(`pitching ${l.name}...`);
    try {
      const outreach = generateOutreach(
        {
          id: l.id,
          name: l.name,
          lat: -1,
          lon: -1,
          category: l.category as any,
          tags: {},
          website: null,
          phone: l.phone ?? null,
          email: l.email ?? null,
          street: null,
          city: null,
          postcode: null,
          openingHours: null,
          instagram: null,
          facebook: null,
          raw: {},
        },
        {
          yourName: state.settings.yourName,
          yourBusiness: state.settings.yourBusiness,
          preferredChannel: l.email ? "email" : "phone",
        }
      );

      if (l.email) {
        await sendMail({
          to: l.email,
          subject: outreach.subject,
          text: outreach.body,
        });
        log(`  emailed ${l.email}`);
        setLeadStatus(l.id, "pitched");
      } else if (l.phone) {
        // Phone-only: we can't SMS without WhatsApp/Twilio. Just log + tell the owner.
        log(`  note: lead has no email — pitch saved in DB (would SMS via Twilio later)`);
        setLeadStatus(l.id, "pitched");
      }
    } catch (e: any) {
      log(`  pitch error: ${e.message}`);
    }
  }

  // 5. Check replies (Gmail IMAP).
  try {
    const replies = await scanInbox(60);
    const positive = replies.filter((r) => r.positive);
    if (positive.length > 0) {
      log(`  ${positive.length} positive replies`);
      for (const r of positive) {
        const owner = state.settings.ownerEmail;
        await sendMail({
          to: owner,
          subject: `Positive reply: ${r.businessName || "lead"}`,
          text: `From: ${r.from}\nSubject: ${r.subject}\n\n${r.snippet}`,
        });
      }
    }
  } catch (e: any) {
    log(`  reply scan error: ${e.message}`);
  }

  // 6. Persist + push state to GitHub / local + HTTP for the dashboard.
  const fresh = await buildState();
  saveLocalState(fresh);
  setState(fresh); // for the optional HTTP server
  try {
    await writeState(fresh);
    log(`state pushed to GitHub`);
  } catch (e: any) {
    log(`state push skipped (${e.message}) — dashboard will read via HTTP if AGENT_PORT set`);
  }
}

// --- main loop ---
async function main() {
  log("agent starting");
  // Optional HTTP server so the Vercel dashboard can read live state when
  // GitHub write access isn't available. AGENT_PORT=0 (default) disables it.
  startAgentServer();

  // Seed the DB with the local state if it's the first run.
  if (!existsSync(LOCAL_STATE)) {
    const seed = await buildState();
    saveLocalState(seed);
  }

  // If INTERVAL_SECONDS is set, loop; otherwise run once.
  const interval = Number(process.env.AGENT_INTERVAL_SECONDS ?? 0);
  if (interval <= 0) {
    await runCycle();
    log("done (single run)");
    return;
  }

  while (true) {
    try {
      await runCycle();
    } catch (e: any) {
      log(`cycle error: ${e.message}`);
    }
    log(`sleeping ${interval}s...`);
    await new Promise((r) => setTimeout(r, interval * 1000));
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});