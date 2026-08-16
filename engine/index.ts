import { scanOverpass } from "./scanners/overpass.js";
import { toLeads, toCsv, leadsToRows } from "./export/csv.js";
import { loadBusinessesFromCsv } from "./export/loader.js";
import { writeFile } from "node:fs/promises";
import { execa } from "execa";
import { osmTagProvider, googlePlacesProvider, applyEnrichment } from "./enrich/enrich.js";
import { generateOutreach } from "./outreach/outreach.js";
import type { Business } from "./types.js";
import { scaffoldSite } from "./builder/scaffold.js";
import { deployVercel } from "./builder/vercel.js";
import { getSite, upsertSite, setLeadStatus, upsertLead } from "./builder/database.js";
import { sendMail, wrapDigest } from "./emailer.js";
import { scanInbox } from "./inbox.js";
import type { ScannedReply } from "./inbox.js";
import "dotenv/config";

const USAGE = `
leadfinder — find local businesses, build them websites, and track replies

Commands:
  scan           Scan an area and export no-website leads (default)
  enrich         Fill missing phone/email/social from a provider
  pitch          Generate a personalized outreach message per lead
  build-site     Scaffold + build a Next.js site for a lead
  deploy-site    Deploy a built site to Vercel and email you the URL
  approve-site   Mark a site approved for pitching after your review
  check-replies  Scan your Gmail inbox for positive replies

Examples:
  node dist/index.js scan --area 40.7127,-74.006 --radius 1 --out leads.csv
  node dist/index.js build-site --name "Green Garden Grill" --category food --phone "555-0100"
  node dist/index.js build-site --in leads.csv --id "osm:node:1"
  node dist/index.js deploy-site --slug green-garden-grill
  node dist/index.js check-replies
`;

type Command =
  | "scan" | "enrich" | "pitch" | "build-site"
  | "deploy-site" | "approve-site" | "status" | "check-replies";

// Parse argv into a record. Loose & simple for a CLI internal tool.
function parseArgs(argv: string[]): Record<string, unknown> {
  const opts: Record<string, unknown> = {};
  opts._command = argv[0]; // may be undefined for bare scan
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.replace(/^--/, "").replace(/-/g, "_");
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("-")) {
      opts[key] = next;
      i++;
    } else {
      opts[key] = true;
    }
  }
  return opts;
}

function help(): void {
  process.stdout.write(USAGE);
}

async function cmdScan(o: Record<string, unknown>): Promise<void> {
  const bbox = o.bbox as string | undefined;
  const area = (o.area as string | undefined) ?? (o.center as string | undefined);
  const [lat, lon] = (area ?? "").split(",").map((s) => Number(s.trim()));
  if (!bbox && (Number.isNaN(lat) || Number.isNaN(lon))) {
    throw new Error("scan needs --area lat,lon or --bbox");
  }
  const radius = Number(o.radius ?? 3);
  const params = bbox ? { bbox } : { lat, lon, radiusKm: radius };
  console.log("Scanning...");
  const { businesses, totalFound } = await scanOverpass(params, !o.all);
  const minScore = Number(o.min_score ?? 0);
  const leads = toLeads(businesses).filter((l) => l.score.total >= minScore);
  leads.sort((a, b) => b.score.total - a.score.total);
  const limit = Number(o.limit ?? 0);
  const sliced = limit > 0 ? leads.slice(0, limit) : leads;
  const rows = leadsToRows(sliced);
  const out = (o.out as string) ?? `leads-${Date.now()}.csv`;
  await writeFile(out, toCsv(rows));
  console.log(`${leads.length} leads (${businesses.length} businesses) stored to ${out}`);
}

async function cmdEnrich(o: Record<string, unknown>): Promise<void> {
  if (!o.in) throw new Error("enrich needs --in <file.csv>");
  const businesses = await loadBusinessesFromCsv(o.in as string);
  const provider = process.env.GOOGLE_PLACES_KEY ? googlePlacesProvider : osmTagProvider;
  const map = await provider.enrich(businesses);
  const enriched = businesses.map((b) => ({ ...applyEnrichment(b, map.get(b.id)), score: 0, likelyWebsiteAbsent: !b.website }));
  const out = (o.out as string) ?? `enriched-${Date.now()}.csv`;
  await writeFile(out, toCsv(leadsToRows(toLeads(enriched))));
  console.log(`Enriched via ${provider.name} → ${out}`);
}

async function cmdPitch(o: Record<string, unknown>): Promise<void> {
  if (!o.in) throw new Error("pitch needs --in <file.csv>");
  const businesses = await loadBusinessesFromCsv(o.in as string);
  const rows = businesses.map((b) => {
    const m = generateOutreach(b, {
      yourName: (o.your_name as string) ?? "Your name",
      yourBusiness: (o.your_business as string) ?? "Webly",
      preferredChannel: (o.channel as never) ?? "email",
    });
    return { name: b.name, category: b.category, email: b.email ?? "", subject: m.subject, body: m.body };
  });
  const out = (o.out as string) ?? `pitches-${Date.now()}.csv`;
  await writeFile(out, toCsv(rows));
  console.log(`Pitch sheet → ${out} (${rows.length} messages)`);
}

async function resolveBusiness(o: Record<string, unknown>): Promise<Business> {
  if (o.name) {
    return {
      id: (o.id as string) ?? "manual",
      name: o.name as string,
      lat: -1,
      lon: -1,
      category: (o.category as never) ?? "other",
      tags: {},
      website: (o.website as string) ?? null,
      phone: (o.phone as string) ?? null,
      email: (o.email as string) ?? null,
      street: (o.street as string) ?? null,
      city: (o.city as string) ?? null,
      postcode: (o.postcode as string) ?? null,
      openingHours: (o.hours as string) ?? null,
      instagram: null,
      facebook: null,
      raw: {},
    };
  }
  if (o.in) {
    if (!o.id) throw new Error("build-site --in needs --id");
    const bs = await loadBusinessesFromCsv(o.in as string);
    const b = bs.find((x) => x.id === o.id);
    if (!b) throw new Error(`Lead ${o.id} not found in ${o.in}`);
    return b;
  }
  throw new Error("build-site needs --name ... or --in <csv> --id <id>");
}

async function runSiteBuild(dir: string, slug: string): Promise<void> {
  console.log(`Installing deps for ${slug}...`);
  try {
    await execa("npm", ["install", "--no-audit", "--no-fund"], { cwd: dir });
  } catch (e) {
    throw new Error(`npm install failed for ${slug}: ${e instanceof Error ? e.message : e}`);
  }
  console.log(`Building ${slug}...`);
  try {
    const { stdout } = await execa("npm", ["run", "build"], { cwd: dir });
    const lines = stdout.trim().split("\n").slice(-8).join("\n");
    console.log(lines);
  } catch (e) {
    throw new Error(`Build failed for ${slug}: ${e instanceof Error ? e.message : e}`);
  }
}

async function cmdBuildSite(o: Record<string, unknown>): Promise<void> {
  const biz = await resolveBusiness(o);
  const ownerEmail = (process.env.OWNER_EMAIL as string) ?? "you@example.com";
  const { dir, config } = await scaffoldSite(biz, ownerEmail);
  upsertSite({ slug: config.slug, leadId: biz.id, dir, status: "built" });
  setLeadStatus(biz.id, "built", config.slug);
  upsertLead({ id: biz.id, name: biz.name, category: biz.category, phone: biz.phone ?? "", email: biz.email ?? "", status: "built" });
  console.log(`Scaffolded site → ${dir}`);
  await runSiteBuild(dir, config.slug);
  console.log(`\nDone. Next: run deploy-site --slug ${config.slug}`);
}

async function cmdDeploySite(o: Record<string, unknown>): Promise<void> {
  const slug = o.slug as string;
  if (!slug) throw new Error("deploy-site needs --slug <slug>");
  const site = getSite(slug);
  if (!site) throw new Error(`No site found for ${slug}. Build it first.`);
  console.log(`Deploying ${slug} to Vercel...`);
  const { url } = await deployVercel(site.dir, slug);
  upsertSite({ slug, leadId: site.leadId, dir: site.dir, status: "deployed", liveUrl: url });
  setLeadStatus(site.leadId ?? "", "deployed", slug, url);
  const owner = (process.env.OWNER_EMAIL as string) ?? "you@example.com";
  try {
    await sendMail({
      to: owner,
      subject: `Site preview: ${slug}`,
      text: `Your ${slug} site is live.\n\nReview it here: ${url}\n\nApprove with: node dist/index.js approve-site --slug ${slug}`,
    });
  } catch (e) {
    console.warn(`(email notify skipped: ${e instanceof Error ? e.message : e})`);
  }
  console.log(`Deployed ${url}\nReview + approve: node dist/index.js approve-site --slug ${slug}`);
}

async function cmdApproveSite(o: Record<string, unknown>): Promise<void> {
  const slug = o.slug as string;
  if (!slug) throw new Error("approve-site needs --slug <slug>");
  const site = getSite(slug);
  if (!site) throw new Error(`No site found for ${slug}`);
  upsertSite({ slug, leadId: site.leadId, dir: site.dir, status: "approved", liveUrl: site.liveUrl ?? undefined });
  setLeadStatus(site.leadId ?? "", "approved");
  console.log(`Marked ${slug} approved. It's safe to pitch now.`);
}

async function cmdCheckReplies(): Promise<void> {
  console.log("Scanning your Gmail inbox for positive replies...");
  let replies: ScannedReply[];
  try {
    replies = await scanInbox(60);
  } catch (e) {
    console.error("check-replies:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
    return;
  }
  const positive = replies.filter((r) => r.positive);
  if (positive.length === 0) {
    console.log(`No positive replies in the last 60 messages.`);
    return;
  }
  const owner = (process.env.OWNER_EMAIL as string) ?? "you@example.com";
  const digest = positive
    .map((r) => `• ${r.businessName} (${r.from})\n   "${r.snippet.slice(0, 140)}"`)
    .join("\n\n");
  await sendMail({
    to: owner,
    subject: `Positive replies: ${positive.length} lead(s) interested`,
    text: `The following businesses responded positively:\n\n${digest}`,
  });
  console.log(`Found ${positive.length} positive replies — emailed digest to ${owner}`);
  for (const r of positive) console.log(`\n• ${r.businessName} — ${r.snippet.slice(0, 120)}`);
}

async function main(): Promise<void> {
  const raw = parseArgs(process.argv.slice(2));
  const first = process.argv[2];
  if (first === "--help" || first === "-h" || first === "help") return help();
  const cmd = typeof raw._command === "string" ? raw._command : "scan";
  try {
    switch (cmd) {
      case "scan": return cmdScan(raw);
      case "enrich": return cmdEnrich(raw);
      case "pitch": return cmdPitch(raw);
      case "build-site": return cmdBuildSite(raw);
      case "deploy-site": return cmdDeploySite(raw);
      case "approve-site": return cmdApproveSite(raw);
      case "check-replies": return cmdCheckReplies();
      case "help": return help();
      default: return help();
    }
  } catch (e) {
    console.error("Error:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}

main();