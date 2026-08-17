/**
 * Agent — runs on the laptop (always-on machine).
 *
 * Autonomous loop:
 *   1. Read state (from local file + GitHub, merge).
 *   2. If auto-scan enabled and interval elapsed: scan → enrich → store new leads.
 *   3. BUILD GATE: sites are built ONLY when the owner clicks "Build Site" on
 *      the dashboard (a `build` action) — never automatically. The site is
 *      scaffolded, built, deployed and a preview URL is emailed to the owner.
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
  insertScan,
  type LeadRec,
} from "../engine/builder/database.js";
import { sendMail } from "../engine/emailer.js";
import { scanInbox } from "../engine/inbox.js";
import { writeState, pullActions } from "./gh.js";
import { startAgentServer, setState } from "./server.js";
import { buildState, saveLocalState, recordManualScan } from "./state.js";

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

    if (a.action === "build") {
      // Build gate: the dashboard's "Build Site" button queues a build action
      // for a lead. The site is built + deployed only after this explicit human
      // approval, never automatically. `slug` here is the lead id (no site exists yet).
      const lead = (await getLeads()).find((l) => l.id === a.slug);
      if (!lead) {
        log(`  -> no lead found for ${a.slug}, skipping`);
        continue;
      }
      if (lead.status !== "new") {
        log(`  -> lead ${lead.name} is ${lead.status}, skipping build (only 'new' leads build)`);
        continue;
      }
      await buildSiteForLead(lead, state.settings.ownerEmail);
      continue;
    }

    log(`action: ${a.action} for ${a.slug}`);
    const site = await getSite(a.slug);
    if (!site) {
      log(`  -> no site found for ${a.slug}, skipping`);
      continue;
    }
    if (a.action === "approve") {
      await setLeadStatus(site.leadId ?? "", "approved");
      await upsertSite({ slug: a.slug, leadId: site.leadId, dir: site.dir, status: "approved", liveUrl: site.liveUrl ?? undefined });
    } else if (a.action === "reject") {
      await setLeadStatus(site.leadId ?? "", "rejected");
      await upsertSite({ slug: a.slug, leadId: site.leadId, dir: site.dir, status: "rejected", liveUrl: site.liveUrl ?? undefined });
    }
  }

  // 2. Scan if enabled and interval elapsed.
  const lastScan = state.settings.lastScanAt ?? "";
  const elapsedMin = lastScan ? (Date.now() - new Date(lastScan).getTime()) / 60000 : 9999;
  if (state.settings.autoScanEnabled && elapsedMin >= state.settings.scanIntervalMinutes) {
    log(`scanning ${state.settings.scanArea} r=${state.settings.radiusKm}km ...`);
    const [latStr, lonStr] = state.settings.scanArea.split(",");
    const scanId = `scan-${Date.now()}`;
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
      await upsertLead({ id: l.id, name: l.name, category: l.category, phone: l.phone ?? "", email: l.email ?? "", status: "new", scanId });
    }

    // Record this auto-scan sweep so the dashboard can group its results.
    await insertScan({
      id: scanId,
      location: state.settings.scanArea,
      label: state.settings.scanArea,
      niche: "",
      radiusKm: state.settings.radiusKm,
      found: leads.length,
      added: leads.length,
      source: "auto",
      coords: { lat: Number(latStr), lon: Number(lonStr) },
      at: now(),
      ok: true,
    });

    state.settings.lastScanAt = now();
  }

  // 3. BUILD GATE: sites are no longer built automatically. A site is only
  //    scaffolded, built and deployed after the owner clicks "Build Site" on
  //    the dashboard, which queues a `build` action handled above.

  // 4. Pitch approved leads (email outreach from your Gmail).
  const dbLeads = await getLeads();
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
        await setLeadStatus(l.id, "pitched");
      } else if (l.phone) {
        // Phone-only: we can't SMS without WhatsApp/Twilio. Just log + tell the owner.
        log(`  note: lead has no email — pitch saved in DB (would SMS via Twilio later)`);
        await setLeadStatus(l.id, "pitched");
      }
    } catch (e: any) {
      log(`  pitch error: ${e.message}`);
    }
  }

  // 5. Check replies (Gmail IMAP). Skipped entirely when Gmail isn't
  //    configured (GMAIL_USER/GMAIL_APP_PASSWORD empty in .env) so an
  //    email-less setup doesn't log an error every cycle.
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
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

/**
 * Build gate step: scaffold + build + deploy a site for one lead, then email
 * the owner the preview link. Only runs when the owner explicitly approved the
 * build from the dashboard (a `build` action) — never automatically.
 */
async function buildSiteForLead(l: LeadRec, ownerEmail: string): Promise<void> {
  // Need an email or phone to reach them.
  if (!l.email && !l.phone) {
    log(`lead ${l.name}: skip (no email/phone)`);
    return;
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
    await setLeadStatus(l.id, "building", undefined);
    const { dir, config } = await scaffoldSite(biz, ownerEmail);
    // Build it
    const { execa } = await import("execa");
    log(`  installing deps...`);
    await execa("npm", ["install", "--no-audit", "--no-fund"], { cwd: dir });
    log(`  building Next...`);
    await execa("npm", ["run", "build"], { cwd: dir });

    await upsertSite({ slug: config.slug, leadId: l.id, dir, status: "built" });
    await setLeadStatus(l.id, "built", config.slug);

    // Deploy to Vercel
    log(`  deploying to Vercel...`);
    const { url } = await deployVercel(dir, config.slug);
    await upsertSite({ slug: config.slug, leadId: l.id, dir, status: "deployed", liveUrl: url });
    await setLeadStatus(l.id, "deployed", config.slug, url);
    log(`  deployed: ${url}`);

    // Email the owner the preview link
    await sendMail({
      to: ownerEmail,
      subject: `Site preview: ${l.name} (${config.slug})`,
      text: `A site has been built for ${l.name}.\n\nPreview: ${url}\n\nApprove: https://leadfinder.vercel.app (or your dashboard URL)\n\nIt will NOT be pitched to the lead until you approve it.`,
    });
    log(`  preview emailed to ${ownerEmail}`);
  } catch (e: any) {
    log(`  build/deploy error: ${e.message}`);
    await setLeadStatus(l.id, "rejected");
  }
}

// --- main loop ---
async function main() {
  log("agent starting");
  // Optional HTTP server so the Vercel dashboard can read live state when
  // GitHub write access isn't available. AGENT_PORT=0 (default) disables it.
  startAgentServer();

  // Warn once at startup if Gmail isn't configured, so the missing-secrets
  // state is visible without erroring every cycle.
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    log(`WARNING: GMAIL_USER / GMAIL_APP_PASSWORD not set in .env — reply scanning, preview emails and outreach are disabled`);
  }
  if (!process.env.OWNER_EMAIL) {
    log(`WARNING: OWNER_EMAIL not set in .env — preview emails have no recipient`);
  }

  // Publish a state snapshot immediately so the dashboard's /api/state never
  // 404s while the first cycle is still running. buildState() reads the Postgres
  // DB (the source of truth) and carries over persisted settings.
  try {
    const initial = await buildState();
    saveLocalState(initial);
    setState(initial);
  } catch (e: any) {
    log(`initial state snapshot failed: ${e.message}`);
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