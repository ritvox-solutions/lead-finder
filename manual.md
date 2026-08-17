# LeadFinder — System Manual

> **Complete pipeline:** Find local businesses without a website → build a personalizable Next.js site → deploy live to Vercel → review via web dashboard → one human click to approve → email outreach → track replies. All automated except the approval click. Dashboard hosted on Vercel; automation agent runs on your laptop.

## Architecture

```
leadfinder/
├── src/                          # Next.js 16 dashboard app (Vercel)
│   ├── app/                      # UI routes
│   │   ├── (page.tsx)            # Dashboard (overview + stats)
│   │   ├── leads/page.tsx        # Lead table (sorted by score)
│   │   ├── sites/page.tsx        # Sites list (Approve/Reject buttons)
│   │   ├── replies/page.tsx      # Inbox scan results (positive highlighted)
│   │   └── settings/page.tsx     # Scan area, cadence, outreach identity
│   ├── app/api/
│   │   ├── state/route.ts        # GET state.json (GitHub or local)
│   │   ├── approve/route.ts      # POST {action, slug} → writes actions.ndjson
│   │   └── scan/route.ts         # (placeholder) trigger a manual scan
│   └── lib/
│       ├── types.ts              # Shared types: Lead, Site, Reply, AppState
│       └── gh.ts                 # GitHub sync (read state, append actions)
├── agent/                        # YOUR LAPTOP ALWAYS-ON AUTOMATION
│   ├── index.ts                  # Main loop: scan→enrich→build→deploy→email→pitch→reply-scan
│   ├── gh.ts                     # Agent-side GH sync (push state, pull actions)
│   └── types.ts                  # Agent state types (mirrors dashboard types)
├── engine/                       # Existing CLI engine (reused as a library)
│   ├── scanners/overpass.ts      # Find businesses via OSM/Overpass
│   ├── enrich/enrich.ts          # Fill missing phone/email/social
│   ├── outreach/outreach.ts      # Personalized pitch message generator
│   ├── builder/                  # Scaffold, build, deploy to Vercel
│   │   ├── scaffold.ts           # Copy template + personalize content.ts
│   │   ├── factory.ts            # Per-category 3D scene + tagline
│   │   ├── palette.ts            # Color palette per category
│   │   ├── vercel.ts             # Deploy to Vercel (create project + prod deploy)
│   │   └── database.ts           # Neon Postgres storage (leads, sites, replies, scans)
│   ├── emailer.ts                # Gmail SMTP send
│   └── inbox.ts                  # Gmail IMAP positive-reply scanner
├── templates/next-site-baseline/ # The Next.js site template (3D, scroll effects)
│   └── src/                      # App Router + TS + Tailwind v4
├── sites/                        # Generated per-business sites (gitignored)
├── .env                          # YOUR SECRETS (NEVER COMMIT)
├── manual.md                     # This file
├── AGENT.md                      # Laptop agent setup (systemd/PM2)
└── vercel.json                   # Vercel deployment config
```

## Credentials (`.env`)

All secrets live in `.env` (gitignored). The dashboard runs on Vercel; the agent runs on your laptop. Each needs different variables.

### For the dashboard (Vercel Environment → Settings → Environment Variables)
```
GITHUB_TOKEN=ghp_...            # GitHub PAT (repo scope) — to read state.json + actions.ndjson
NEXT_PUBLIC_GH_OWNER=anikethanshetty
NEXT_PUBLIC_GH_REPO=leadfinder-state
NEXT_PUBLIC_GH_BRANCH=main
```
- The `NEXT_PUBLIC_` prefix means these are inlined into the client bundle (safe for owner/repo names; the **token** reads the repo via the `/api/state` server route, not from the browser — keep `GITHUB_TOKEN` server-side only).

### For the laptop agent (your `.env`)
```
GITHUB_TOKEN=ghp_...            # same token, or a separate one
GH_OWNER=anikethanshetty
GH_REPO=leadfinder-state        # the repo the agent creates/uses
GH_BRANCH=main

GMAIL_USER=shettyanikethand@gmail.com
GMAIL_APP_PASSWORD=xxxx-...      # 16-char APP password (NOT your login password)
VERCEL_TOKEN=vcp_...            # Vercel personal access token
OWNER_EMAIL=shettyanikethand@gmail.com
YOUR_NAME=Anikethan
YOUR_BUSINESS=Webly

# Scan defaults (override from Settings dashboard too)
SCAN_AREA=51.5074,-0.1278
SCAN_RADIUS_KM=3
MIN_SCORE=40
AUTO_SCAN_ENABLED=false   # set true to scan on every due cycle (off by default)
SCAN_INTERVAL_MINUTES=30
```

### ⚠️ Gmail app password (CRITICAL)
Gmail with 2-Step Verification **rejects** a normal login password for SMTP/IMAP (`534 Application-specific password required`). You MUST generate a 16-character app password:
1. Google Account → Security → 2-Step Verification (must be ON)
2. App passwords → Generate → paste the 16 chars into `.env` as `GMAIL_APP_PASSWORD`.

## How the data flows

```
                   HTTPS (Cloudflare Tunnel)
┌─────────────┐          GET /state         ┌────────────────────┐
│  Your Laptop │  ────────────────────────→  │ Vercel Dashboard   │
│  (agent)     │                             │ (https://...red.vercel.app)
└─────────────┘                             └─────────▲──────────┘
     │                                                 │
     │ writes state.json locally                       │ you click Approve/Reject
     │ serves on :8090 (/state, /health, /action)      │ → POST /api/approve
     │                                                 │
     │        POST /action (approve/reject)            │
     │  ◄───────────────────────────────────────────────┘
     │
     │   live-*.vercel.app (site previews)
     └───────────────────────────────────  (deployed by the agent)
```

1. The agent runs on your laptop; **`cloudflared tunnel`** exposes its
   `:8090` HTTP port over a public `https://<name>.trycloudflare.com` URL.
2. The Vercel environment variable `LEADFINDER_AGENT_URL` points at that tunnel.
3. The dashboard fetches live state (`GET /state`), so it shows the latest leads,
   sites, and replies within ~30 s of each agent cycle.
4. When you click **Approve** or **Reject** on the dashboard, its `/api/approve`
   route writes the action to the agent's `actions.ndjson` over
   `POST /action` (falls back to GitHub `actions.ndjson` if the token can write).
5. The agent polls `actions.ndjson` on its next cycle, applies your decision.
   On `approve` it pitches the lead by email.

> ⚠️ A **quick tunnel** URL (`*.trycloudflare.com`) is **ephemeral** and changes
> each time you restart `cloudflared`. For a permanent address, create a named
> tunnel on your own domain. See `AGENT.md`.

## Usage

### 1. One-time setup
```bash
cd /home/anikethan/Desktop/leadfinder
npm install                    # install dashboard + agent deps (one-time)
```
Create `.env` on your laptop (see Credentials above) and ensure `AGENT_PORT=8090`.

### 2. Start the agent + tunnel (on your laptop, 24/7)

```bash
# Terminal 1 — the automation loop + HTTP state server:
npx tsx agent/index.ts

# Terminal 2 — expose it to the internet (free Cloudflare Tunnel):
cloudflared tunnel --url http://localhost:8090
# → prints https://<name>.trycloudflare.com

# Continuous 30-min cycles:
AGENT_INTERVAL_SECONDS=1800 npx tsx agent/index.ts
```

See `AGENT.md` for a systemd unit that auto-starts both on boot.

### 3. Using the dashboard (from anywhere)
- Open `https://leadfinder-red.vercel.app`.
- `/` → overview (stats: total leads, pending approvals, deployed/approved/pitched sites, positive replies; quick-action cards).
- `/leads` → all businesses sorted by score, with contact + status + Approve quick-link.
- `/sites` → deployed sites; the **✅ Approve** / **❌ Reject** buttons are the only human action. Approve releases a site for outreach; the agent pitches it on the next cycle.
- `/replies` → positive Gmail replies (highlighted) + all scanned replies, linked back to leads.
- `/settings` → scan area, radius km, min score, your name/business, scan cadence, auto-scan toggle.

### 4. The approval gate (the only human step)
- The agent builds + deploys a site and emails you (`OWNER_EMAIL`) a preview link (`/sites` shows it too).
- It will **NOT** email the business until you click **Approve** on the dashboard. On the next agent cycle it then pitches the lead via email and flips status to `pitched`.
- Clicking **Reject** stops the site from being pitched.

## The site template (the built websites)
Each generated business site (e.g. `green-garden-grill`) is a Next.js App Router project with:
- **3D hero**: `three.js` / `@react-three/fiber` / `@react-three/drei` scene per category (restaurant, retail, services, etc.).
- **Scroll animations** via `framer-motion`.
- **Category color palette** auto-selected (`palette.ts`).
- 7 static pages (Home, Services, About, Contact, sitemap.xml, robots.txt).
- Personalized content (`content.ts`, written per-business).
- Deployed as a production build (`next build`) → one Vercel project per business.

## Engine CLI (still works standalone)
All the original CLI commands are preserved under `engine/`:
```bash
npx tsx engine/index.ts scan      --area 51.5074,-0.1278 --radius 3 --out leads.csv
npx tsx engine/index.ts enrich    --in leads.csv
npx tsx engine/index.ts pitch     --in leads.csv --your-name Anikethan --your-business Webly
npx tsx engine/index.ts build-site --name "Green Garden Grill" ...
npx tsx engine/index.ts deploy-site --slug green-garden-grill
npx tsx engine/index.ts check-replies
```

## WhatsApp (paused)
WhatsApp outreach via your personal number is **not enabled yet**. It requires `whatsapp-web.js` (unofficial, QR-login per session) or the official Twilio/WhatsApp Business API (Meta Business Manager + phone + billing). Email outreach is active now; WhatsApp is a documented future phase (see `manual.md` WhatsApp section). Re-enable when ready.

## Data sources: OpenStreetMap

All business discovery is built on free OpenStreetMap services — no API key
required. Two are used:

### Overpass API (`engine/scanners/overpass.ts`)
Queries OSM for businesses that have **no website** (`[!"website"][!"contact:website"][!"url"]`)
within a radius or bbox, split into one query per top-level key
(`amenity`, `shop`, `office`, …) so free mirrors can serve them. Dedupes by OSM
id and falls back across mirror endpoints if one is rate-limited or down.

Env knobs:
- `OVERPASS_URL` — primary mirror (default `https://overpass.kumi.systems/api/interpreter`)
- `OVERPASS_DELAY_MS` — optional pacing between per-key queries (e.g. `1000`);
  free mirrors rate-limit aggressively, so set this if scans return partial results
- `CONTACT_EMAIL` / `OWNER_EMAIL` — reachable contact advertised in the
  `User-Agent` (required by OSM's usage policy; defaults to `OWNER_EMAIL`)

### Nominatim (`engine/geocode.ts`)
Geocodes place names ("Yeshwanthpur, Bangalore") to lat/lon for manual scans,
with a Google Geocoding fallback when `GOOGLE_MAPS_KEY`/`GOOGLE_PLACES_KEY` is
set. Honors Nominatim's 1 request/second policy between retry attempts.

Both services require a descriptive `User-Agent` with a real contact address —
shared via `engine/osm/usage.ts`, so set `CONTACT_EMAIL` (or `OWNER_EMAIL`)
before heavy use. See the [OSM usage policy](https://operations.osmfoundation.org/policies/nominatim/)
for the exact terms.

## Troubleshooting
- **Dashboard stays blank / "No state"**: the agent's HTTP server isn't reachable. Check `AGENT_PORT=8090` in `.env`, that the agent is running, and that `LEADFINDER_AGENT_URL` on Vercel matches your current `cloudflared` tunnel URL. Tunnel URLs rotate on restart — update `LEADFINDER_AGENT_URL` and redeploy after a rotation.
- **Approve button does nothing / stuck**: check `.env` has `NEXT_PUBLIC_GH_OWNER`/`NEXT_PUBLIC_GH_REPO`/server-side `GITHUB_TOKEN`. Approve writes `actions.ndjson`; the agent picks it up on the next cycle.
- **SMTP "Application-specific password required"**: Gmail needs an app password (see Credentials above).
- **Deploy fails "next: command not found"**: agent's `npm install` in the site dir didn't finish; rerun deploy-site.
- **Scan returns 0 businesses**: free Overpass mirrors are rate-limited. Set `GOOGLE_PLACES_KEY` to use Google Places enrichment instead, or retry later.

## Verified (current)
- `next build` compiles; all dashboard routes resolve (200 on `/`, `/leads`, `/sites`, `/replies`, `/settings`, `/api/state`).
- Agent runs on your laptop (`AGENT_PORT=8090`); `cloudflared tunnel` exposes it at `https://<name>.trycloudflare.com`.
- Dashboard deployed to Vercel: `https://leadfinder-red.vercel.app` reads live state from the tunnel.
- Full approval gate works end-to-end: agent built + deployed `green-garden-grill`, you (via the test) approved it, the agent **pitched it** by emailing `hello@ggg-example.com`.
- SMTP `sendMail` delivers to `shettyanikethand@gmail.com`.
- `check-replies` authenticates via app password, scans inbox, exits cleanly.
