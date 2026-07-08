# $FAMILY World — Private Concept Prototype

A premium, game-style community hub concept for the $FAMILY XRPL project.
This is a **front-end only demo** — no wallet connection, no backend, no
live XRPL data. All stats are static placeholder values in `lib/demo-data.ts`.

Not linked from the live site. This lives on its own branch until it's
reviewed and ready to connect to real data (the Telegram Family Vault bot +
XRPL ledger).

## Stack

- Next.js (App Router, static export)
- Tailwind CSS v4
- Framer Motion
- lucide-react icons

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Building the static export

```bash
npm run build
```

Outputs static HTML/CSS/JS to `out/` (configured via `output: "export"` in
`next.config.ts`), ready to host anywhere — including GitHub Pages —
once this is approved to go live.

## Structure

- `app/page.tsx` — the world map homepage (stats bar, profile card, clickable
  zones, preview panels)
- `app/vault`, `app/house`, `app/fishing-dock`, `app/leaderboard`,
  `app/lp-lake`, `app/village`, `app/missions`, `app/help` — one detail page
  per world zone
- `components/` — WorldMap, ZonePin, TopBar, ProfileCard, PageShell, and
  preview cards
- `lib/demo-data.ts` — all placeholder demo data in one place, ready to be
  swapped for live data later
