# MARCOVAULT

Multi-chain alpha, curated research, and execution infrastructure — behind machined steel.

Landing + intelligence dashboard for the Vault community: live DexScreener/CoinGecko data,
boost & paid feeds, community takeovers, rug scanner, watchlist and price alerts.

## Design System — "MONOLITH"

Cinematic chrome for the big moments, private-bank discipline for content. Anchored on the
VM monogram: one chrome ramp (sampled from the logo), graphite void surfaces, champagne-gold
hairlines, sage/oxide market deltas. Full spec:
`docs/superpowers/specs/2026-08-10-vaultmarco-redesign-design.md`.

- **Hero** — real 3D: the display type and monogram are extruded meshes sharing one PBR
  chrome material and studio rig (three + react-three-fiber). Static fallback for mobile,
  reduced-motion and no-WebGL.
- **Type** — Unbounded (display) · Instrument Sans (UI) · Spline Sans Mono (data), all
  self-hosted via Fontsource.
- **Motion** — Lenis smooth scroll + Framer Motion; vault-door preloader (once per
  session); everything respects `prefers-reduced-motion`.

## Tech Stack

- React 19 + Vite 7 (static SPA) · TanStack Router · TanStack Query
- Tailwind CSS v4 (CSS-first tokens in `src/styles.css`) · Radix UI / shadcn
- three / @react-three/fiber / drei (hero only, lazy-loaded & code-split)
- Data: DexScreener + CoinGecko public APIs, fetched directly from the client
  (CORS-open; graceful mock fallbacks). No server, no env vars required.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # static output in dist/
```

## Deploy (Vercel)

Pure static SPA: `vite build` → `dist/` with the existing `vercel.json` rewrite.
Push to deploy — no configuration or environment variables needed.

## Brand asset pipeline (`scripts/`)

- `prep-monogram.py` — un-mattes the logo's white fringe (`marcovault-logo-dark.png`,
  favicon) and builds the letterform mask
- `trace-monogram.mjs` — potrace → `src/assets/monogram.svg` (3D extrusion source)
- `woff2-to-ttf.py` + `ttf-to-typeface.mjs` — Unbounded → three.js typeface JSON for the
  3D display text
- `audit.mjs` — route crawl: console errors, internal link/anchor resolution, external
  `rel=noopener` (run with dev server up: `node scripts/audit.mjs`)

## Structure

```
src/
├── components/marco/         # landing scenes + dashboard surfaces
│   ├── shell/                # SmoothScroll, Preloader, Reveal, SectionHeading
│   └── three/                # HeroScene (3D chrome), fallbacks, shared material
├── components/ui/            # shadcn/ui primitives (restyled via tokens)
├── hooks/                    # data hooks (DexScreener, CoinGecko, watchlist, alerts)
├── routes/                   # TanStack file routes (/ + /dashboard/*)
└── styles.css                # MONOLITH tokens & utilities (single source of truth)
```

## License

MIT
