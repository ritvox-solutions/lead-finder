# leadfinder

Finds local businesses that likely have **no website**, fills in their contact details, and drafts a personalized outreach message — a complete lead pipeline for selling web design / dev services to local businesses.

The data is free (OpenStreetMap via the Overpass API) — no API keys required to get started.

## Quick start

```bash
npm install
npm run build
```

### 1. Scan — find no-website businesses in an area

```bash
node dist/index.js scan --area 40.7127,-74.006 --radius 1 --min-score 60 --out leads.csv
```

- `--area lat,lng` — scan center (default output `leads-<ts>.csv`)
- `--radius km` — radius around center (default 3 km)
- `--bbox "s,w,n,e"` — exact box instead of center/radius
- `--min-score N`, `--limit N`, `--all`

### 2. Enrich — fill missing phone/email/social

```bash
node dist/index.js enrich --in leads.csv --out enriched.csv
```

Uses OSM tags by default (free). For a real phone + website, set `GOOGLE_PLACES_KEY` and it uses the Google Places adapter:

```bash
GOOGLE_PLACES_KEY=your_key node dist/index.js enrich --in leads.csv --out enriched.csv
```

### 3. Pitch — draft a personalized message per lead

```bash
node dist/index.js pitch --in enriched.csv --your-name "Alex" --your-business "Webly" --channel email --out pitches.csv
```

`--channel` one of `email | whatsapp | phone | sms | instagram`. Output is a CSV with one `subject` + `body` per business.

## How the scoring works (the "lead" part)

- **No website** (+50) — core signal
- **Has a phone** (+10) — you can actually reach them
- **Has an address** (+10) — locatable, real business
- **Lists opening hours** (+15) — signals active operation
- **High-value category** (+5) — food, retail, medical, professional, automotive, home, services convert best to paid web work

Rank leads by score, starting at the top.

## Project layout

```
src/
  index.ts             CLI entry + subcommands (scan | enrich | pitch)
  types.ts             Shared types (Business, Lead, scores)
  scanners/overpass.ts OSM/Overpass fetch + parse, multi-mirror retry
  features/lead.ts     Lead scoring heuristics
  enrich/enrich.ts     Contact providers (OSM tags, Google Places)
  outreach/outreach.ts Per-lead message generator
  export/csv.ts        CSV read/write
  export/loader.ts     Read leads CSV back into Business objects
```

## Roadmap

- Better offline sources / paid lead lists for phone+email coverage
- A static one-page site builder + deploy target (the actual product)
- Optional LLM-driven personalization of pitches
- Later: wrap as a Conway `skills/` module so the loop runs autonomously

## Notes on honesty & compliance

- **"No website" is a signal, not a guarantee.** OSM website tags aren't complete. Verify on Google Maps before pitching.
- Cold outreach must add genuine value — keep messages personalized and non-spammy. This tool drafts the message; you decide who and how to send.