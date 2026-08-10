import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "./Logo";
import { scrollToId, stopScroll } from "./shell/SmoothScroll";
import { EASE_VAULT } from "./shell/Reveal";

const ANCHORS = [
  { label: "ECOSYSTEM", id: "ecosystem" },
  { label: "INTELLIGENCE", id: "intelligence" },
  { label: "ACCESS", id: "access" },
  { label: "FAQ", id: "faq" },
] as const;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    stopScroll(open);
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const anchorClick = (id: string) => (e: React.MouseEvent) => {
    setOpen(false);
    if (onHome) {
      e.preventDefault();
      scrollToId(id);
    }
  };

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-[50] transition-[background-color,border-color] duration-500"
        style={{
          backgroundColor: scrolled ? "rgba(5,5,6,0.94)" : "transparent",
          borderBottom: scrolled ? "1px solid var(--hairline)" : "1px solid transparent",
        }}
      >
        <div className="u-container flex h-[72px] items-center justify-between">
          <Link
            to="/"
            onClick={onHome ? () => scrollToId("hero") : undefined}
            aria-label="MARCOVAULT home"
            className="[&_.logo-sub]:max-lg:hidden"
          >
            <Logo />
          </Link>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            {ANCHORS.map((a) => (
              <Link
                key={a.id}
                to="/"
                hash={a.id}
                onClick={anchorClick(a.id)}
                className="group relative font-mono text-[11px] tracking-[0.22em] text-(--muted-2) transition-colors duration-300 hover:text-(--bone)"
              >
                {a.label}
                <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-(--gold) transition-all duration-500 group-hover:w-full" />
              </Link>
            ))}
            <Link
              to="/dashboard"
              className="chrome-fill flex items-center gap-2 px-5 py-2.5 font-mono text-[11px] font-semibold tracking-[0.18em] transition-[filter] duration-300 hover:brightness-110"
            >
              DASHBOARD
              <ArrowUpRight className="size-3.5" strokeWidth={2.4} />
            </Link>
          </nav>

          {/* mobile burger — two machined lines */}
          <button
            className={`relative grid size-10 place-items-center md:hidden ${open ? "invisible" : ""}`}
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-hidden={open}
            tabIndex={open ? -1 : 0}
          >
            <span
              className="absolute h-px w-6 bg-(--bone) transition-transform duration-500"
              style={{ transform: open ? "rotate(45deg)" : "translateY(-4px)" }}
            />
            <span
              className="absolute h-px w-6 bg-(--bone) transition-transform duration-500"
              style={{ transform: open ? "rotate(-45deg)" : "translateY(4px)" }}
            />
          </button>
        </div>
      </header>

      {/* fullscreen index menu (mobile) */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60] flex flex-col bg-(--void) md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE_VAULT }}
          >
            <div className="u-container flex h-[72px] items-center justify-between">
              <Logo />
              <button
                className="relative grid size-10 place-items-center"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <span className="absolute h-px w-6 rotate-45 bg-(--bone)" />
                <span className="absolute h-px w-6 -rotate-45 bg-(--bone)" />
              </button>
            </div>
            <nav className="u-container mt-10 flex flex-1 flex-col" aria-label="Mobile">
              {[{ label: "HOME", id: "hero" }, ...ANCHORS].map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ y: 34, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.7, delay: 0.08 + i * 0.07, ease: EASE_VAULT }}
                  className="hairline-b"
                >
                  <Link
                    to="/"
                    hash={a.id === "hero" ? undefined : a.id}
                    onClick={anchorClick(a.id)}
                    className="flex items-baseline gap-5 py-5"
                  >
                    <span className="mono-data text-[11px] text-(--gold)">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-display text-[22px] font-medium tracking-[0.06em] text-(--bone)">
                      {a.label}
                    </span>
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={{ y: 34, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.5, ease: EASE_VAULT }}
                className="mt-8"
              >
                <Link
                  to="/dashboard"
                  onClick={() => setOpen(false)}
                  className="chrome-fill flex items-center justify-between px-6 py-4 font-mono text-[12px] font-semibold tracking-[0.2em]"
                >
                  OPEN DASHBOARD
                  <ArrowUpRight className="size-4" strokeWidth={2.4} />
                </Link>
              </motion.div>
              <div className="mt-auto flex items-center justify-between py-8">
                <a
                  href="https://t.me/DxmZone"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono-label text-(--muted-2)!"
                >
                  TELEGRAM ↗
                </a>
                <a
                  href="https://x.com/vaultmarco"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono-label text-(--muted-2)!"
                >
                  X / TWITTER ↗
                </a>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
