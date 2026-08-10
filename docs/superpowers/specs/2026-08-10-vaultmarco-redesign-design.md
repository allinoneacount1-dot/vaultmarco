# MARCOVAULT Redesign — "MONOLITH" (Hybrid) Design Spec

Date: 2026-08-10
Status: Approved by owner (direction 03 MONOLITH, hybrid variant)
Scope: Landing page (full redesign) + Dashboard (full restyle, functionality preserved)

## 1. Concept

Cinematic chrome monolith for the big moments; private-bank editorial discipline for content.
The site should feel like the opening sequence of a film about a giant metal vault, while the
content reads like a precision banking document. Anchored 100% on the existing VM chrome
monogram logo (silver metal + thin champagne-gold ring on black).

Why this fits the repo's own taste: the codebase's identity is "the Vault" — operator
language ("MULTI-CHAIN OPS", "sniper-grade", "Enter the vault"), a Telegram-first alpha
community, and a name that promises secured wealth. The current neon-cyan skin fights that
identity; machined chrome + disciplined dark editorial IS that identity.

Explicitly banned (anti-AI-slop list): neon cyan/mint/violet, glassmorphism, glowing borders,
floating particles, background grids, purple-cyan text gradients, infinite pulsing animations,
emoji icons in UI, default-Inter look.

## 2. Design System

### 2.1 Color (CSS custom properties, dark-only — ThemeToggle removed)

| Token          | Value     | Use |
|----------------|-----------|-----|
| `--void`       | `#050506` | page background, hero scenes |
| `--graphite`   | `#0B0C0E` | section surfaces |
| `--panel`      | `#101114` | dashboard panels, elevated surfaces |
| `--bone`       | `#E8E6E1` | primary text |
| `--muted`      | `#8A8D93` | secondary text |
| `--faint`      | `#63666C` | micro-labels |
| `--gold`       | `#C2A878` | ONLY accent: index numbers, 1px hairlines, active states, orbit dot |
| `--hairline`   | `rgba(232,230,225,.08)` | borders/dividers |
| `--up` (sage)  | `#7FA588` | positive change |
| `--down` (oxide)| `#B4726A`| negative change |
| chrome gradient| `#FDFEFF → #D5DAE0 → #61666D → #EDF0F3 → #9AA0A7` | display type & metal accents |

Film grain: fixed full-screen SVG-noise overlay, opacity ≤ 0.5, mix-blend overlay.

### 2.2 Typography (self-hosted via Fontsource; no external font requests)

- Display: **Unbounded** (variable, 500–800) — colossal scene type, section titles,
  wordmark. (Default; subject to the §2.4.5 chrome-render validation.)
- UI/body: **Instrument Sans** (variable) — paragraphs, buttons, nav.
- Data: **Spline Sans Mono** (variable) — ALL numbers, tickers, tags, micro-caps labels
  (letter-spacing .2em+, uppercase, 10–12px).
- Old fonts (Space Grotesk/Inter/JetBrains Mono declarations that never loaded) removed.

### 2.3 Motion — "mewah & elegant" (owner requirement)

- Lenis smooth scroll (weighted, lerp ~0.08) + Framer Motion (already a dep) scroll-scrub.
- Signature easing everywhere: `cubic-bezier(.16,1,.3,1)` ("heavy vault door"), durations
  0.8–1.2s. Nothing snaps; everything decelerates like mass.
- **Preloader (first visit per session):** black screen, monogram engraves in via mask,
  gold hairline draws the ring, counter in mono, then the whole cover parts like a vault
  door (two panels slide out) revealing the hero. Skipped on revisit (sessionStorage) and
  for reduced-motion.
- **Route transitions:** landing ↔ dashboard cross-fade through `--void` with a 1px gold
  hairline wipe (no hard cut).
- Vocabulary: line-mask headline reveals (text rises out of its own baseline), hairlines
  that draw themselves on entry, chrome light-sweep tied to scroll progress, stagger
  choreography (80–120ms) for index rows, hover = gold hairline draw / chrome fill on
  text / arrow glides (no scale-pop, no bounce).
- The ONLY perpetual motions: ticker marquee + gold orbit dot (slow, ≥20s cycles).
- `prefers-reduced-motion`: every scrub/reveal becomes static; 3D replaced by still render;
  preloader skipped.

### 2.4 Material Identity — "warna identik, bukan tempelan" (owner requirement)

The logo is the single source of truth for all metal. Chrome ramp sampled from the actual
logo pixels (`src/assets/marcovault-logo.png`, solid-alpha region):

`#FFFFFF → #F8F6F0 → #A3A29E → #757471 → #383737 → #0F0F0E` (p99→p12 luminance).

Rules:
1. One shared PBR chrome material for BOTH the 3D monogram and the 3D "ENTER THE VAULT"
   text — same scene, same lighting rig, same bevel language → impossible to look pasted-on.
2. Every CSS chrome-gradient text uses stops from the sampled ramp above (not invented
   colors), angled 175–180° like the logo's top-lit shading.
3. Gold accent `#C2A878` is taken from the champagne ring of the owner-supplied dark logo
   variant; pale-champagne `#CECCC1` (sampled from repo asset ring) is the secondary warm
   hairline tone.
4. The repo logo PNG has a white-matte fringe (traced off white) that halos on dark
   backgrounds — the "sticker" effect. Produce a cleaned, dark-matte version for all 2D
   uses; 2D placements always get contact shadow / engraved treatment, never flat paste.
5. Display type must feel kin to the monogram's faceted, blade-like letterforms; 3D text
   bevel profile tuned to visually match the monogram bevels. Final display-font pick
   (Unbounded vs a sharper angular candidate, e.g. Michroma/Chakra Petch) is validated by
   rendering all candidates as 3D chrome in the actual hero and choosing the one that
   reads as family with the monogram — decided during build, before landing sign-off.

## 3. Landing Architecture (route `/`)

0. **PRELOADER** — vault-door reveal (see §2.3). Once per session.
1. **NAV** (fixed, z-50): monogram + `MARCOVAULT` wordmark; mono links ECOSYSTEM ·
   INTELLIGENCE · ACCESS · FAQ; chrome button `DASHBOARD`. Transparent at top → solid
   `--void`/95 + bottom hairline after scroll. Mobile: fullscreen overlay index menu (z-60).
   GasTracker/WhaleAlert/ThemeToggle/ConnectButton removed from nav.
2. **SCENE 01 — HERO** (100vh, single R3F `<Canvas>`, lazy-loaded):
   - **Real 3D chrome text** "ENTER THE VAULT" — extruded with bevel (owner requirement:
     "font enter-nya seperti 3D rendering"), chrome PBR material, studio reflections.
   - 3D VM monogram (traced from logo PNG → SVG → ExtrudeGeometry, beveled, chrome).
   - Thin gold torus ring orbiting; analytic/Lightformer studio lighting only (no HDR fetch).
   - Camera parallax with inertia on cursor; slow auto-drift when idle.
   - Kicker mono line above, scroll cue + stat micro-row below.
   - Fallbacks: WebGL unavailable / mobile-small / reduced-motion → static composed hero
     (CSS chrome gradient type + logo PNG), identical layout.
   - Bottom edge: live ticker marquee (real market data via existing hooks).
3. **SCENE 02 — MANIFESTO**: scroll-scrub statement, words illuminate bone→chrome as user
   scrolls; ends with mono stat row (14+ CHAINS · 24/7 DESK · MULTI-CHAIN OPS).
4. **SCENE 03 — ECOSYSTEM INDEX**: all 13 existing ecosystem items as numbered hairline
   rows (01–13): gold index, title (chrome-fill on hover), one-line desc, mono channel tag
   (TELEGRAM / BOT / TERMINAL / DESK), ↗. All existing URLs preserved exactly.
5. **SCENE 04 — INTELLIGENCE**: framed dashboard preview (styled miniature of the real
   dashboard) + mono module list + CTA `OPEN DASHBOARD` → `/dashboard`.
6. **SCENE 05 — STATEMENT**: full-viewport chrome type "WEALTH MOVES IN SILENCE." with
   scroll light-sweep + ring motif. CSS type (no second canvas).
7. **SCENE 06 — ALLIED NETWORKS**: partnerships as hairline grid, mono category labels.
   Existing partner data preserved.
8. **SCENE 07 — ACCESS**: Community Group / Alpha Channel / X as ledger-style rows with
   member counts; contact form retained but submits WITHOUT backend: composes message →
   opens Telegram (primary) / mailto (secondary). Old `/api/partnership/inquiry` call
   removed (endpoint never existed in production).
9. **FAQ**: hairline accordion (Radix), serif-free, mono numbering.
10. **FOOTER**: giant ghost engraved monogram, sitemap columns, mono legal line, gold
    top hairline. Social links preserved.

SEO/meta/JSON-LD blocks in `routes/index.tsx` preserved and updated to new copy.
Copy language: English, rewritten sharper; meaning of current content preserved.

## 4. Dashboard Restyle (routes `/dashboard/*`)

- Same system: `--graphite` shell, `--panel` panels with hairline borders + mono caption
  headers; page titles small Unbounded; ALL numerics mono; sage/oxide deltas; charts
  re-skinned monochrome + sage/oxide (lightweight-charts + recharts themes).
- Sidebar: Connect Wallet block removed; red "Exit Dashboard" → quiet `← MARCOVAULT`;
  active item = gold left tick + bone text; GasTracker moves to dashboard topbar.
- KPI cards → bordered stat cells (no glow, no scale-pop hovers).
- All existing modules and their functionality preserved: Command Center, DEX Trending,
  Paid Trending, Live Market, Boost Feed, Community Takeovers, Rug Scanner, Watchlist,
  Price Alerts, FAQ, Tools, auth route.

## 5. Data Layer Fix (production bug)

`vite build` produces a static SPA; `vercel.json` rewrites `/api/*` → `index.html`, so the
DexScreener proxy and partnership endpoint NEVER worked on Vercel (feeds silently fell back
to mocks). Fix: `useDexScreener` (and related hooks) fetch `https://api.dexscreener.com`
directly (public CORS API), keeping existing mock fallbacks on failure. Server route files
`src/routes/api/**` and `src/server.ts` deleted. Result: real live data on Vercel with a
pure static deploy.

## 6. 3D Implementation

- Deps: `three`, `@react-three/fiber`, `@react-three/drei`.
- Assets: monogram SVG traced from `src/assets/marcovault-logo.png` (build-time, committed);
  Unbounded glyphs → three typeface JSON (build-time script, committed) for `Text3D`.
- One canvas only (hero). Lazy `import()` after first paint; DPR clamped ≤ 2;
  `frameloop="demand"`-style pausing when off-viewport/hidden tab.
- Lighting: Lightformers/analytic lights composed into an env map at runtime — zero network.

## 7. Wiring, Overlap & Z-Index Rules

- Documented z-scale: content 0–10, ticker 20, nav 50, mobile menu 60, modals 100,
  toasts 110, preloader/route-transition veil 120.
- Every anchored section: `id` + `scroll-margin-top` ≥ nav height.
- Anchor links must work cross-route: nav uses router `Link to="/" hash="…"` (current raw
  `#home` hrefs break from `/dashboard`).
- Fix stuck `whileInView` half-transparent cards: `viewport={{ once: true, margin: "-10%" }}`.
- External links: `target="_blank" rel="noopener noreferrer"`.
- No negative-margin section overlaps; consistent container widths.

## 8. Cleanup

Remove deps: `@rainbow-me/rainbowkit`, `wagmi`, `viem`, `@supabase/supabase-js` (verified
unused), related providers in `main.tsx`, `src/lib/wagmi.ts`, wallet UI in Navbar/Sidebar/
Features. Add deps: `three`, `@react-three/fiber`, `@react-three/drei`, `lenis`,
`@fontsource-variable/unbounded`, `@fontsource-variable/instrument-sans`,
`@fontsource-variable/spline-sans-mono`. `.env.example` trimmed to used vars only.
README updated to reflect the new stack/design.

## 9. Vercel Zero-Conflict Guarantee

- Build command unchanged (`vite build` → `dist/`), `vercel.json` unchanged, pure static
  output, no server functions, no env vars required. Push-and-deploy with no dashboard
  changes.

## 10. Verification (definition of done)

1. `npm run build` passes clean (no type errors; chunk warnings addressed via manualChunks
   for three/vendor).
2. Playwright sweep: screenshot every route (`/`, `/dashboard` + all 10 sub-routes, `/auth`)
   at 1440/834/390 widths — visual pass, no overlap.
3. Link audit script: crawl rendered pages, assert every internal href resolves and every
   external href is well-formed with `rel=noopener`.
4. Console-error audit: zero errors on all routes (WalletConnect noise gone).
5. Anchor audit: every nav/footer anchor scrolls to a section that exists, from both `/`
   and `/dashboard`.
6. Reduced-motion pass: with `prefers-reduced-motion`, hero renders static fallback, no
   preloader, page fully usable.
