# Leadfinder — Project Summary

## What it is

An end-to-end lead-generation and outreach pipeline for selling web design/dev
services to local businesses. It finds businesses with **no website** using
free OpenStreetMap data, scores them as leads, auto-generates and deploys a
personalized Next.js preview site for each one, waits for a human approval
click, then emails the business a pitch and watches for replies — all with
one manual gate (approval) in an otherwise automated loop.

## Architecture — three parts

```
leadfinder/
├── engine/     Core library + standalone CLI (scan/enrich/pitch/build/deploy/replies)
├── agent/      Always-on automation loop, meant to run on your laptop
└── src/        Next.js dashboard (Vercel), reviews leads/sites/replies, Approve/Reject
```

- **`engine/`** — the reusable pipeline logic, also exposed as a CLI
  (`node engine/index.ts scan|enrich|pitch|build-site|deploy-site|approve-site|check-replies`).
  - `scanners/overpass.ts` — queries OSM/Overpass (multi-mirror, free, no key) for businesses
  - `features/lead.ts` — lead scoring: no website +50, phone +10, address +10, hours +15, high-value category +5
  - `enrich/enrich.ts` — fills phone/email/social from OSM tags (free) or Google Places (if `GOOGLE_PLACES_KEY` set)
  - `outreach/outreach.ts` — generates a personalized pitch message per lead/channel
  - `builder/` — scaffolds a site from `templates/next-site-baseline`, builds it, deploys to Vercel; `database.ts` stores leads/sites/replies/scans in Neon Postgres (`pg`)
  - `emailer.ts` / `inbox.ts` — Gmail SMTP send + IMAP reply scanning/classification
  - `geocode.ts` — place-name → lat/lon (Nominatim, free; Google Geocoding fallback)

- **`agent/`** — the always-on process (`agent/index.ts`). One cycle:
  1. Apply pending approve/reject actions from the dashboard
  2. Scan (if due) → enrich → store new leads
  3. For each new lead with contact info: build site → deploy to Vercel → email owner the preview (**not** the lead — approval gate)
  4. For each **approved** lead: send the outreach email, mark `pitched`
  5. Scan Gmail for positive replies → email a digest
  6. Persist state locally and push to GitHub (or serve it over HTTP) for the dashboard

  Also runs a tiny HTTP server (`agent/server.ts`, port from `AGENT_PORT`) exposing
  `GET /state`, `GET /health`, `POST /action` (approve/reject/manual-scan) — this exists
  because the GitHub token used is typically read-only, so state can't be pushed to GitHub
  and must be served directly instead (via a Cloudflare tunnel when the dashboard is remote).

- **`src/`** — Next.js 16 dashboard (App Router, Tailwind v4). Pages: overview (`/`),
  `leads/`, `replies/`, `scan/`, `settings/`. API routes (`src/app/api/*`) read state by
  trying the agent's HTTP endpoint first (`LEADFINDER_AGENT_URL`), then a public state URL,
  then the GitHub API — whichever is configured. `POST /api/approve` and `POST /api/scan`
  forward actions to the agent.

## Data flow

```
Overpass scan → lead scoring → enrichment (OSM tags / Google Places)
  → site scaffold (templates/next-site-baseline) → Vercel deploy
  → email owner a preview link → [human clicks Approve on dashboard]
  → outreach email sent to the business → Gmail IMAP watches for replies
  → positive replies classified and digested back to the owner
```

State (leads/sites/replies/scans) lives in **Neon Postgres** — the agent
(`engine/builder/database.ts`, `pg`) and the dashboard (`src/lib/db.ts`,
`@neondatabase/serverless`) both read/write the same `DATABASE_URL`, so both
sides always agree. A one-time script (`scripts/migrate-sqlite-to-neon.ts`,
`npm run migrate:neon`) copies the old local `leadfinder.db` into Neon.

## Tech stack

Next.js 16 (Turbopack) + React 19 + Tailwind v4 for the dashboard; TypeScript +
`tsx` for the engine/agent; **Neon Postgres** (`pg` for the agent, `@neondatabase/serverless` for the dashboard); `nodemailer` (SMTP) +
`imapflow` (IMAP) for email; `execa`/Vercel CLI for site builds/deploys;
`@octokit/rest` for GitHub state sync; Overpass/Nominatim/Google Places as data
sources. No LLM in the loop currently (outreach copy is templated, not generated).

## Running it locally

```
npm install
npm run dev:all      # dashboard (:3000) + agent (:8090) together, one terminal
```

Individual pieces:
- `npm run dev` — dashboard only
- `npm run agent` — agent loop only (`agent:watch` restarts it on file changes)
- `npm run cli -- scan --area 40.7127,-74.006 --radius 1 --out leads.csv` — engine CLI directly

`.env` holds all secrets (Gmail app password, Vercel token, GitHub PAT, scan
defaults) — see the file's inline comments for what each variable does and
which features need it. Scan/enrich/pitch work with zero configuration
(free data sources); build-site/deploy-site/check-replies/the agent loop need
Gmail + Vercel credentials filled in first.

## Notable things worth knowing

- **Security:** `AGENT.md` (tracked in git, already pushed to the public repo
  `github.com/Anikethanshetty/Leadfinder`) contains a real-looking Gmail app
  password and Vercel token in plaintext as a documentation example. Treat
  those as compromised — do not reuse them in `.env`. `.env` itself is
  correctly gitignored.
- **Approval gate is the only human step** — everything else (scan, build,
  deploy, pitch, reply-check) runs unattended once configured.
- **`node_modules` on this machine had a corrupted `tsx` binary shim**,
  fixed by reinstalling; `better-sqlite3` needed no native build despite
  first appearances — v13 ships prebuilt Windows binaries in the package.
- **`AUTO_SCAN_ENABLED` is off by default** — the agent never auto-scans
  unless you set `AUTO_SCAN_ENABLED=true` in `.env`. Manual scans from the
  dashboard always work regardless of this flag.
