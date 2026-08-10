import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { HeroSceneLazy } from "./three/HeroSceneLazy";
import { LiveTicker } from "./LiveTicker";
import { scrollToId } from "./shell/SmoothScroll";
import { EASE_VAULT } from "./shell/Reveal";

/** SCENE 01 — the monolith: real 3D chrome type + monogram. */
export function Hero() {
  return (
    <section id="hero" className="relative flex h-[100svh] min-h-[640px] flex-col overflow-hidden">
      {/* 3D stage (or static fallback) */}
      <HeroSceneLazy />

      {/* soft floor shadow anchoring the metal */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[30vh]"
        style={{ background: "linear-gradient(180deg, transparent, rgba(5,5,6,0.9) 78%)" }}
      />

      {/* kicker */}
      <motion.div
        className="pointer-events-none relative z-[10] mt-[104px] flex justify-center"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.15, ease: EASE_VAULT }}
      >
        <div className="mono-label flex items-center gap-3 text-[11px]! text-(--muted-2)!">
          <span className="inline-block size-1 rounded-full bg-(--gold)" />
          MULTI-CHAIN INTELLIGENCE
          <span className="inline-block size-1 rounded-full bg-(--gold)" />
        </div>
      </motion.div>

      {/* bottom chrome bar */}
      <div className="relative z-[10] mt-auto">
        <motion.div
          className="u-container mb-8 flex flex-col gap-8 md:flex-row md:items-end md:justify-between"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.45, ease: EASE_VAULT }}
        >
          <p className="max-w-[42ch] text-[14px] leading-relaxed text-(--muted-2)">
            Multi-chain alpha, curated research, and sniper-grade execution — engineered for
            operators who trade signal, not noise.
          </p>

          <div className="flex items-center gap-4">
            <a
              href="https://t.me/DxmZone"
              target="_blank"
              rel="noopener noreferrer"
              className="chrome-fill px-6 py-3.5 font-mono text-[11px] font-semibold tracking-[0.18em] transition-[filter] duration-300 hover:brightness-110"
            >
              JOIN THE VAULT
            </a>
            <Link
              to="/dashboard"
              className="gold-hairline-b px-1 py-3.5 font-mono text-[11px] tracking-[0.18em] text-(--bone) transition-colors duration-300 hover:text-(--gold)"
            >
              OPEN DASHBOARD
            </Link>
          </div>

          <button
            onClick={() => scrollToId("manifesto")}
            className="mono-label hidden items-center gap-3 transition-colors duration-300 hover:text-(--bone) md:flex"
            aria-label="Scroll to content"
          >
            SCROLL
            <span aria-hidden className="inline-block transition-transform duration-500 group-hover:translate-y-1">
              ↓
            </span>
          </button>
        </motion.div>

        <LiveTicker />
      </div>
    </section>
  );
}
