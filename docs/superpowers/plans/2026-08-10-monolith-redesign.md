# MARCOVAULT "MONOLITH" Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild MARCOVAULT's landing as a cinematic chrome experience (real 3D hero text + monogram) and restyle the dashboard to the same machined-metal system, per spec `docs/superpowers/specs/2026-08-10-vaultmarco-redesign-design.md`.

**Architecture:** Vite + React 19 SPA (TanStack Router) stays static (`vite build` → `dist/`, unchanged `vercel.json`). One lazy R3F canvas in the hero renders extruded chrome text + monogram sharing a single material/lighting rig. All server routes are deleted; DexScreener is fetched directly (public CORS). Design system lives in `src/styles.css` tokens consumed by both landing and dashboard (shadcn vars remapped so ui/* auto-restyles).

**Tech Stack:** Tailwind v4 (CSS-first), Framer Motion, Lenis, three + @react-three/fiber + @react-three/drei, Fontsource variable fonts (Unbounded, Instrument Sans, Spline Sans Mono).

## Global Constraints (from spec — apply to every task)

- Colors ONLY from spec §2.1/§2.4: void `#050506`, graphite `#0B0C0E`, panel `#101114`, bone `#E8E6E1`, muted `#8A8D93`, faint `#63666C`, gold `#C2A878`, hairline `rgba(232,230,225,.08)`, up `#7FA588`, down `#B4726A`, chrome ramp `#FFFFFF→#F8F6F0→#A3A29E→#757471→#383737→#0F0F0E`, pale-champagne `#CECCC1`.
- BANNED: neon cyan/mint/violet, glassmorphism/backdrop-blur cards, glow shadows, particles, bg grids, purple-cyan gradients, infinite pulse/scale loops, emoji in UI.
- Fonts: Unbounded (display), Instrument Sans (UI), Spline Sans Mono (all numerals/labels) — self-hosted Fontsource only.
- Easing `cubic-bezier(.16,1,.3,1)`, durations 0.8–1.2s; only perpetual motions = ticker marquee + orbit dot (≥20s).
- Z-scale: content 0–10, ticker 20, nav 50, mobile menu 60, modal 100, toast 110, preloader/veil 120.
- All existing URLs (t.me/DxmZone, t.me/DexMultichain, achilles bot, padre.gg, X) preserved verbatim; external links `target="_blank" rel="noopener noreferrer"`.
- Every `section[id]` gets `scroll-margin-top`; nav anchors use router `Link to="/" hash="…"`.
- No new server code; build must stay `vite build`; no new env vars.
- Copy: English. Reduced-motion: static fallbacks everywhere.
- Verification loop for every task: `npm run build` passes + Playwright screenshot(s) of affected routes reviewed (script `/tmp/shots2.mjs` pattern), before commit.

---

### Task 1: Purge wallet stack, add new deps, rewrite design tokens

**Files:**
- Modify: `package.json` (remove `@rainbow-me/rainbowkit`, `wagmi`, `viem`, `@supabase/supabase-js`; add `three`, `@react-three/fiber`, `@react-three/drei`, `lenis`, `@fontsource-variable/unbounded`, `@fontsource-variable/instrument-sans`, `@fontsource-variable/spline-sans-mono`, dev `opentype.js`)
- Modify: `src/main.tsx` (drop Wagmi/RainbowKit providers + CSS import)
- Delete: `src/lib/wagmi.ts`
- Modify: `src/components/marco/Navbar.tsx`, `src/components/marco/DashboardSidebar.tsx`, `src/components/marco/Features.tsx` (strip `ConnectButton`/wallet UI minimally — full rewrites come later)
- Rewrite: `src/styles.css`

**Interfaces (Produces):** CSS custom props `--void --graphite --panel --bone --muted --faint --gold --hairline --up --down --ease-vault`; utilities `.chrome-text .mono-label .hairline-b .grain-overlay .u-container`; font families `--font-display` (Unbounded), `--font-sans` (Instrument Sans), `--font-mono` (Spline Sans Mono). Shadcn vars (`--background --foreground --card --primary --accent --border --ring` etc.) remapped to the new palette (primary = bone on graphite, accent = gold, destructive = oxide).

- [ ] Step 1: `npm rm @rainbow-me/rainbowkit wagmi viem @supabase/supabase-js && npm i three @react-three/fiber @react-three/drei lenis @fontsource-variable/unbounded @fontsource-variable/instrument-sans @fontsource-variable/spline-sans-mono && npm i -D opentype.js`
- [ ] Step 2: `main.tsx` → plain `QueryClientProvider` + `RouterProvider`; delete `lib/wagmi.ts`; strip wallet imports/JSX from the three components.
- [ ] Step 3: Rewrite `styles.css`: keep `@import "tailwindcss" source(none); @source "../src"; @custom-variant dark`, add Fontsource imports, define tokens above, remap ALL shadcn vars to palette, define utilities; delete `.glass* .glow* .grid-bg .text-gradient .text-chrome .border-glow` (grep consumers → replace with quiet equivalents inline where still referenced).
- [ ] Step 4: Verify `npm run build` clean; dev screenshots `/` + `/dashboard` (will look half-styled — acceptable; no crash, no wallet). Commit `feat: monolith foundation — tokens, fonts, wallet purge`.

### Task 2: Static-safe data layer (production fix)

**Files:**
- Modify: `src/hooks/useDexScreener.ts` (`const API_BASE = "https://api.dexscreener.com"`), check `src/hooks/useMarketPrices.ts`, `src/hooks/useCryptoNews.ts` for `/api/` bases and point them to their public origins likewise (keep existing mock fallbacks).
- Modify: `src/components/marco/ContactForm.tsx` — remove `fetch("/api/partnership/inquiry")`; on valid submit, build `const text = encodeURIComponent(...)` and `window.open("https://t.me/DxmZone", "_blank")` after copying the composed message to clipboard, with `mailto:` fallback link shown; keep zod validation + sonner toasts.
- Delete: `src/routes/api/` (entire dir), `src/server.ts`; regenerate route tree (`npx vite dev` touch or `npx tsr generate` via router plugin during build).

**Interfaces (Produces):** hooks keep identical exported signatures/return shapes (consumers unchanged).

- [ ] Step 1: Point bases at public APIs; delete server files; fix `routeTree.gen.ts` regeneration by running build.
- [ ] Step 2: ContactForm rework as above.
- [ ] Step 3: Verify build + `/dashboard` screenshot (feeds show mock fallback in sandbox — fine). Commit `fix: static-safe data layer, remove dead api routes`.

### Task 3: Brand 3D assets pipeline (trace + typeface + clean PNG)

**Files:**
- Create: `scripts/trace-monogram.mjs` (npm `potrace` — traces `src/assets/marcovault-logo.png` → cleaned single-path SVG)
- Create: `src/assets/monogram.svg` (committed output; viewBox square, fill `#fff`)
- Create: `scripts/woff2-to-ttf.py` (fontTools+brotli: decompress Fontsource Unbounded woff2 → `scripts/tmp/unbounded-bold.ttf`) and `scripts/ttf-to-typeface.mjs` (opentype.js → three typeface JSON)
- Create: `src/assets/unbounded-bold.typeface.json` (committed)
- Create: `scripts/clean-logo.py` (un-matte white fringe: for semi-alpha pixels, `rgb_new = clamp((rgb - (1-a)*255)/a)`) → `src/assets/marcovault-logo-dark.png` + smaller `public/favicon.png` replacement (32/180/512 multi-use single 512px)
- Modify: `package.json` devDeps `potrace`

**Interfaces (Produces):** `monogram.svg` (single combined path, fill-rule evenodd), `unbounded-bold.typeface.json` (three Font JSON with A–Z, 0–9, punctuation), `marcovault-logo-dark.png` (fringe-free RGBA).

- [ ] Step 1: Write + run trace script; open SVG over dark bg screenshot — verify silhouette fidelity (V, M, ring optional separate path; if ring traces poorly, draw ring as `<circle>` programmatically — geometry uses torus anyway, SVG used only for extrusion of the VM letterforms; drop ring from path).
- [ ] Step 2: `pip install fonttools brotli --break-system-packages`; run woff2→ttf; run ttf→typeface (subset chars `A-Z0-9 .,+/—·%$↗`); validate JSON loads in three via a 10-line node smoke script.
- [ ] Step 3: Run clean-logo; visual check on dark swatch (no halo). Commit `feat: brand 3d asset pipeline (traced monogram, typeface, clean logo)`.

### Task 4: HeroScene — one canvas, shared chrome

**Files:**
- Create: `src/components/marco/three/chrome.ts` (shared material factory + Lightformer rig)
- Create: `src/components/marco/three/HeroScene.tsx`
- Create: `src/components/marco/three/HeroSceneLazy.tsx` (React.lazy + Suspense + capability gate)
- Create: `src/components/marco/three/HeroStatic.tsx` (fallback: `marcovault-logo-dark.png` + `.chrome-text` colossal type, identical layout)

**Interfaces:**
- Consumes: Task 3 assets.
- Produces: `<HeroSceneLazy line1="ENTER" line2="THE VAULT" />` — fills parent (absolute inset-0), transparent background; exports nothing else.

Core scene (complete inside task): `Canvas dpr={[1,2]} gl={{antialias:true, alpha:true}} camera={{fov:35, position:[0,0,10]}}`; `<Environment resolution={256}>` with 4 Lightformers (top key 8×3 intensity 3, left cool rim, right warm `#CECCC1` rim, bottom fill 0.6) — no external HDR; `chromeMaterial = new MeshStandardMaterial({metalness:1, roughness:.14, color:'#d9dbde', envMapIntensity:1.25})`; monogram: `SVGLoader` → shapes → `ExtrudeGeometry({depth:14, bevelEnabled:true, bevelThickness:3, bevelSize:2.2, bevelSegments:5})`, centered/scaled ~2.6 units, position `[0,0.4,-1.2]`; text: two `<Text3D font={typeface} size={1.05} height={0.34} bevelEnabled bevelThickness={0.045} bevelSize={0.028} bevelSegments={4} curveSegments={8} letterSpacing={0.04}>` lines centered, front `z=0.6`; gold ring: `<mesh rotation.x≈1.1><torusGeometry args={[2.9,0.012,16,128]}/><meshStandardMaterial color='#C2A878' metalness={1} roughness={.35}/></mesh>` + small orbit dot sphere animated `t*0.28`; whole group in cursor-parallax rig: `useFrame` lerp `group.rotation.y → pointer.x*0.22`, `x → -pointer.y*0.12`, factor 0.04 (inertia) + idle drift `sin(t*0.1)*0.04`; scroll tilt via `scrollY/vh * -0.15` on group.rotation.x.
Pause: wrap in `IntersectionObserver` — when out of view set `invalidate`-driven `frameloop='demand'`… simpler deterministic: parent unmounts canvas when `document.hidden` or hero scrolled >120% out (keep mounted state via `useInView(margin:'20%')`).
Capability gate in `HeroSceneLazy`: `matchMedia('(prefers-reduced-motion: reduce)')` OR `innerWidth<768` OR no `WebGLRenderingContext` → render `HeroStatic`.

- [ ] Step 1: Build `chrome.ts` + `HeroScene` on an isolated dev route `/dev-hero` (temp file `src/routes/dev-hero.tsx`, deleted in Task 8).
- [ ] Step 2: Screenshot loop until material reads as the logo's chrome (bright speculars, gunmetal core, crisp bevels) — tune roughness/env intensities. THIS IS THE §2.4.5 GATE: render Unbounded vs fallback candidates only if Unbounded reads wrong as chrome (decision recorded in commit message).
- [ ] Step 3: Verify fallback path by forcing gate. Build clean. Commit `feat: hero 3d scene — shared chrome for text + monogram`.

### Task 5: Experience shell — Lenis, preloader, veil, nav, footer, primitives

**Files:**
- Create: `src/components/marco/shell/SmoothScroll.tsx` (Lenis rAF loop, respects reduced-motion; exported `<SmoothScroll>{children}</SmoothScroll>` used in `__root.tsx`)
- Create: `src/components/marco/shell/Preloader.tsx` (sessionStorage `mv_seen`; monogram mask engrave → ring draw (SVG strokeDashoffset) → mono counter → two panels translate out; z-120; total ≤2.4s; skips on reduced-motion)
- Create: `src/components/marco/shell/Reveal.tsx` (`<Reveal delay stagger>` line-mask util: children wrapped in overflow-hidden, inner `motion.div` y `110%→0`, ease vault, `viewport={{once:true, margin:'-10%'}}`)
- Create: `src/components/marco/shell/SectionHeading.tsx` (`<SectionHeading index="03" title="Ecosystem" />` → gold mono `03 —` + hairline + Unbounded small-caps title)
- Rewrite: `src/components/marco/Navbar.tsx` → `MonolithNav`: fixed z-50; top transparent → scrolled `bg-[--void]/95 border-b hairline`; left monogram(img dark png, h-7)+`MARCOVAULT` (Unbounded 600, 12px, tracking .28em); links mono 11px ECOSYSTEM · INTELLIGENCE · ACCESS · FAQ (Link to="/" hash) + `DASHBOARD` chrome button (`.chrome-fill` bg gradient from ramp, void text); mobile: burger → fullscreen overlay z-60, index-style rows with gold numerals, body scroll-locked.
- Rewrite: `src/components/marco/Footer.tsx`: ghost monogram (dark png, opacity .05, -bottom offset), 3 sitemap cols (Navigate / Ecosystem / Legal-Social), mono legal `MARCOVAULT — EST. 2024 · ALPHA, KEPT BEHIND STEEL`, gold top hairline.
- Modify: `src/routes/__root.tsx`: wrap Outlet in SmoothScroll + Preloader + grain overlay div; global `section[id]{scroll-margin-top:96px}` lives in styles.css.

**Interfaces (Produces):** `Reveal`, `SectionHeading` used by all Task 6 scenes; nav/footer link sets final.

- [ ] Step 1: Build primitives + root wiring; Step 2: nav (desktop+mobile) + footer; Step 3: screenshots (top, scrolled, mobile menu open, preloader frame via fresh context) — verify z-order/no overlap; build; commit `feat: experience shell — lenis, preloader, nav, footer`.

### Task 6: Landing scenes (routes/index.tsx assembly)

**Files:**
- Rewrite: `src/components/marco/Hero.tsx` (Scene 01: full-viewport; HeroSceneLazy center; kicker mono top `MULTI-CHAIN INTELLIGENCE · LIVE`; under-row `SCROLL ↓ / 14+ CHAINS / 24/7 DESK`; bottom `LiveTicker` restyled as hairline marquee z-20)
- Rewrite: `src/components/marco/About.tsx` → `Manifesto.tsx` (Scene 02: scroll-scrub word illumination `useScroll`+`useTransform` per-word opacity `--faint→bone`, statement: "The market screams. The Vault does not. Multi-chain alpha, curated research, sniper-grade execution — behind machined steel."; stat row mono)
- Rewrite: `src/components/marco/Ecosystem.tsx` → EcosystemIndex (Scene 03: 13 rows: gold index 01–13, title Unbounded 500 18px (hover: `.chrome-text` fill + x-shift 6px), desc muted 13px, tag mono chip hairline (TELEGRAM/BOT/TERMINAL/DESK), ↗ glides; stagger reveal; existing hrefs verbatim)
- Rewrite: `src/components/marco/Features.tsx` → Intelligence (Scene 04: framed miniature of new dashboard (pure JSX mock: sidebar strip, KPI cells, feed rows w/ sage/oxide deltas) in hairline frame with mono window-caption `VAULT://INTELLIGENCE`; right column module list mono; CTA chrome `OPEN DASHBOARD` → Link `/dashboard`)
- Create: `src/components/marco/Statement.tsx` (Scene 05: 100vh, CSS `.chrome-text` colossal `WEALTH MOVES\nIN SILENCE.` with scroll-linked background-position light-sweep + thin ring SVG behind; nothing else)
- Rewrite: `src/components/marco/Partnerships.tsx` (Scene 06: hairline grid cells, mono category label + name, existing partner data/modal preserved, no colored logo chips → monochrome initials in hairline squares)
- Rewrite: `src/components/marco/Contact.tsx` + `ContactForm` styles (Scene 07 ACCESS: 3 ledger rows Community/Alpha/X w/ mono meta + ↗; form: hairline inputs (b-only border, focus gold), labels mono 10px, submit chrome)
- Rewrite: `src/components/marco/Faq.tsx` (hairline accordion, gold index numerals, chevron→plus rotate 45°)
- Rewrite: `src/routes/index.tsx` (compose scenes in order; update meta/OG/JSON-LD copy; delete unused imports)
- Delete: `src/components/marco/Particles.tsx`, `TiltCard.tsx`, `MagneticButton.tsx`, `RevealText.tsx`, `ScrollProgress.tsx`, `ThemeToggle.tsx`, `WhaleAlertIcon.tsx`, `GasTracker.tsx` from landing (GasTracker moves to dashboard Task 7 — keep file), `Terminal.tsx`, `SocialProof.tsx` content folded into Manifesto stats + Access rows (delete file), `SectionHeader.tsx` superseded by `SectionHeading`.

**Interfaces:** Consumes Reveal/SectionHeading/HeroSceneLazy; `Sections.tsx` barrel updated to new exports.

- [ ] Per scene: build → screenshot desktop 1440 + 390 → tune → next. Statement/Manifesto get scrub screenshots at 3 scroll points. Commit per 2–3 scenes: `feat: landing scenes 01–03`, `04–07 + faq/footer assembly`.

### Task 7: Dashboard restyle (function untouched)

**Files:**
- Rewrite styles of: `DashboardSidebar.tsx` (graphite, hairline-r, active = 2px gold left tick + bone; remove wallet block; footer link `← MARCOVAULT`; GasTracker chip into `DashboardLayout` topbar), `DashboardLayout.tsx` (topbar: page breadcrumb mono + GasTracker + live dot), `Panel.tsx` (hairline frame, mono caption header w/ gold dot, no glow), `KPICards.tsx` (stat cells: mono label 10px, value 22px semibold, delta sage/oxide, hairline dividers not gaps), `Skeleton.tsx` (graphite shimmer), `shared/helpers.ts` (`getTierColor` → hairline+sage/gold/muted quiet variants; remove emoji from `getAdTypeIcon` → mono glyphs ▲■●), `PriceChart.tsx` + `chart.tsx` theme (bg transparent, grid `rgba(232,230,225,.05)`, up `#7FA588` down `#B4726A`, line bone), `DexRealtimeTab.tsx`, `CommandCenter.tsx`, `Watchlist*.tsx`, `PriceAlertsPanel.tsx`, `RugScannerModal.tsx`, `PartnerDashboardModal.tsx`, and each `routes/dashboard.*.tsx` header (`text-gradient`→plain bone Unbounded 20px; kill entrance scale/spring pops → simple fade-up once).
- Modify: `routes/auth.tsx` same skin.

**Interfaces:** Consumes tokens only; zero logic/prop changes.

- [ ] Sweep file-by-file (grep list: `text-gradient|glass|glow|primary/20|violet|cyan|mint|red-400|green-400|backdrop-blur`); build; screenshot ALL dashboard routes desktop+mobile; commit `feat: dashboard restyle — machined metal system`.

### Task 8: Wiring, audits, perf, docs — definition of done

**Files:**
- Create: `scripts/audit.mjs` (Playwright: visit `/`, `/dashboard`, all subroutes, `/auth`; collect console errors; collect all `a[href]` → assert internal targets resolve (route table) & anchors have matching `[id]`; assert external have `rel~=noopener`; exit 1 on violations)
- Modify: `vite.config.ts` (`build.rollupOptions.output.manualChunks: { three: ['three','@react-three/fiber','@react-three/drei'], vendor-charts: ['recharts','lightweight-charts'] }`)
- Modify: `README.md` (new design system + stack section, remove RainbowKit/Supabase mentions), `.env.example` (trim to `VITE_SITE_*` only), `index.html` (title/meta keep MARCOVAULT copy, ensure favicon points at cleaned asset)
- Delete: `src/routes/dev-hero.tsx`, dead components from Task 6 list, `src/components/marco/Logo.tsx` if superseded.

- [ ] Step 1: grep bans (`cyan|violet|mint|glass|glow-|grid-bg|text-gradient|ConnectButton|wagmi|rainbow|animate-pulse|Infinity`) → zero hits in `src` (except sanctioned marquee/orbit).
- [ ] Step 2: run audit script → zero errors; fix anything found.
- [ ] Step 3: full screenshot sweep 1440/834/390 all routes + reduced-motion run (`page.emulateMedia({reducedMotion:'reduce'})`) + fresh-session preloader check.
- [ ] Step 4: `npm run build` + `npx vite preview` smoke; bundle report sanity (three chunk lazy).
- [ ] Step 5: Update README; final commit `feat: monolith redesign — audits, perf, docs`; deliver screenshots + summary to owner.

## Self-Review

- Spec coverage: §2 tokens/fonts/motion/material → T1/T4/T5; §3 scenes 0–10 → T5/T6; §4 dashboard → T7; §5 data → T2; §6 3D → T3/T4; §7 wiring → T5/T8; §8 cleanup → T1/T6/T8; §9 Vercel → T2/T8 (no config change); §10 verification → T8. ✔
- Type consistency: `HeroSceneLazy` props (`line1/line2`), `Reveal`/`SectionHeading` signatures used consistently in T5→T6. Hook signatures unchanged (T2). ✔
- No placeholders: every step names exact files/values; scene copy included. ✔
