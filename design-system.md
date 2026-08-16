# LeadFinder — "ARC" Command Center Design System

A dark, futuristic, JARVIS-like operational command center for AI prospecting.
LeadFinder scans local-business websites, finds the ones missing a web presence,
enriches them, and emails each owner a tailored cold-outreach pitch.

## Design personality

- Operative, high-tech, calm. Feels like controlling a small aerospace AI.
- Near-black backgrounds with cyan + emerald electric accents and soft glows.
- Glassmorphism panels (frosted, subtle borders), bento-grid stat layout.
- Monospace accents (numbers, timestamps, status tags) on clean sans body.
- Motion: subtle, goal-directed. Scan page feels like a live mission.
- Generous spacing, rounded (xl) panels, hairline (1px) borders, low-contrast hairlines
  at ~8-12% opacity, focus glow rings.

## Color tokens

- `bg-primary`: `#05070D` — deepest page background (near-black with blue tint)
- `bg-panel`: `#0B0F1A` — cards, columns, terminals
- `bg-inset`: `#0E1420` — nested panels, code blocks, inputs
- `bg-elevated`: `#141A2A` — raised cards, dropdowns
- `border`: `#1E2740` (12% white equivalent)
- `border-bright`: `#2A3760`
- `text-primary`: `#E7EBF6`
- `text-secondary`: `#9AA3B8`
- `text-muted`: `#5B6478`
- `accent-cyan`: `#22D3EE` — primary action, live/scans
- `accent-emerald`: `#34D399` — success, verified, online
- `accent-amber`: `#FBBF24` — warnings, pending
- `accent-rose`: `#FB7185` — danger, failed
- `accent-violet`: `#A78BFA` — replies, secondary
- `glow-cyan`: `rgba(34,211,238,0.18)`
- `glow-emerald`: `rgba(52,211,153,0.16)`

### Surfaces
- Body bg: radial vignette of cyan/emerald 6% over `bg-primary`.
- Panels: `backdrop-blur` heavy; border hairline; inner top highlight line
  `linear-gradient(180deg, rgba(255,255,255,0.05), transparent 40%)`.

## Typography

- UI / sans: system stack — `Inter, "SF Pro Display", Segoe UI, Roboto, sans-serif`
- Numbers / readouts / codes: `JetBrains Mono, "SF Mono", Menlo, monospace`
- Sizes (rem): xs 0.75, sm 0.8125, base 0.875, md 1, lg 1.25, xl 1.5, 2xl 2
- Weights: 400 / 500 / 600 / 700. Heads uppercase letter-spaced for tiny labels.
- Labels: `text-[11px] font-semibold uppercase tracking-[0.16em] text-muted`

## Components

- **Sidebar nav**: slim (14rem), bg slightly translucent, hover glow, active item =
  cyan text + left 2px bar + faint cyan panel. Items: Overview, Leads, Scan,
  Sites, Replies, Settings.
- **TopBar**: page title left, live status pill + "Run Scan" + avatar right.
- **GlassCard**: translucent panel, hairline border, optional "operational" label.
- **StatTile**: label + 2xl mono value + delta + icon w/ colored glow; used in a
  4-column bento grid in the Overview; secondary row = mini panels (Pipeline, Live activity).
- **StatusBadge**: dot + uppercase 10px label; variants success/warn/error/neutral,
  colored dot with ring.
- **NeonButton**: primary = cyan border + cyan text + glow shadow, hover brightens;
  ghost = hairline; danger = rose.
- **Table**: header = uppercase tiny labels; rows hairline-divided, hover = faint
  cyan row tint; status column uses StatusBadge; mono values right-aligned.
- **Log / terminal line**: mono, colored prefix tag `[02:41:13]`, state chip, text-muted message.
- **ProgressBar**: thin (4px) rounded track `bg-inset`, animated gradient fill cyan→emerald.
- **Radar / scan visual**: concentric ring + rotating sweep (CSS animation) accent-cyan.
- **Toggle**: pill track + glowing knob (emerald = on).
- **Field**: dark input, hairline border, focus ring cyan (2px @ 25% opacity).

## Behavior & tone
- Stale/error framing: amber/rose status pills with subtle pulse.
- Table rows clickable on rows where detail navigation exists.
- Everything reads as instrumentation: every card shows its "data source" in tiny
  mono text in its corner (e.g. `OSM·OVERPASS`, `GMAIL·IMAP`, `LIVE AGENT`).
- Live values update with a soft flash; transitioning values get a `transition-colors`.
- Icon set: sharp outline linear icons (Feather/Lucide-style), stroke-width 1.6.
  Icons used: radar (scan), map-pin (geocode), search (query), globe (websites),
  database (sources), mail (replies), users (leads), settings (config), activity (status).

## Screen list (top nav order)
1. Overview
2. Leads
3. Scan (command center)
4. Sites
5. Replies
6. Settings