import { Link } from "@tanstack/react-router";
import { scrollToId } from "./shell/SmoothScroll";
import logoDark from "@/assets/marcovault-logo-dark.png";
import { Logo } from "./Logo";

const NAVIGATE = [
  { label: "Home", id: "hero" },
  { label: "Ecosystem", id: "ecosystem" },
  { label: "Intelligence", id: "intelligence" },
  { label: "Access", id: "access" },
  { label: "FAQ", id: "faq" },
];

const ECOSYSTEM = [
  { label: "Community Group", href: "https://t.me/DxmZone" },
  { label: "Alpha Channel", href: "https://t.me/DexMultichain" },
  { label: "Sniper Bot", href: "https://t.me/achilles_trojanbot?start=r-oxjackpot" },
  { label: "Padre Terminal", href: "https://trade.padre.gg/rk/dexmultichain" },
];

const CONNECT = [
  { label: "Telegram", href: "https://t.me/DxmZone" },
  { label: "X / Twitter", href: "https://x.com/vaultmarco" },
  { label: "Alpha Broadcast", href: "https://t.me/DexMultichain" },
];

export function Footer() {
  return (
    <footer className="hairline-t relative overflow-hidden bg-[rgba(5,5,6,0.94)]">
      {/* engraved ghost monogram */}
      <img
        src={logoDark}
        alt=""
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-24 w-[520px] select-none opacity-[0.05]"
        loading="lazy"
        decoding="async"
      />
      <div className="u-container relative py-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo size={40} />
            <p className="mt-6 max-w-[36ch] text-[13.5px] leading-relaxed text-(--muted-2)">
              Multi-chain alpha, curated research, and execution infrastructure — behind machined
              steel.
            </p>
          </div>

          <div>
            <div className="mono-label mb-6 text-(--gold)!">NAVIGATE</div>
            <ul className="space-y-3.5">
              {NAVIGATE.map((n) => (
                <li key={n.id}>
                  <Link
                    to="/"
                    hash={n.id === "hero" ? undefined : n.id}
                    onClick={(e) => {
                      if (window.location.pathname === "/") {
                        e.preventDefault();
                        scrollToId(n.id);
                      }
                    }}
                    className="text-[13.5px] text-(--muted-2) transition-colors duration-300 hover:text-(--bone)"
                  >
                    {n.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/dashboard"
                  className="text-[13.5px] text-(--muted-2) transition-colors duration-300 hover:text-(--bone)"
                >
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="mono-label mb-6 text-(--gold)!">ECOSYSTEM</div>
            <ul className="space-y-3.5">
              {ECOSYSTEM.map((n) => (
                <li key={n.label}>
                  <a
                    href={n.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group text-[13.5px] text-(--muted-2) transition-colors duration-300 hover:text-(--bone)"
                  >
                    {n.label}
                    <span className="ml-1.5 inline-block transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                      ↗
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mono-label mb-6 text-(--gold)!">CONNECT</div>
            <ul className="space-y-3.5">
              {CONNECT.map((n) => (
                <li key={n.label}>
                  <a
                    href={n.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group text-[13.5px] text-(--muted-2) transition-colors duration-300 hover:text-(--bone)"
                  >
                    {n.label}
                    <span className="ml-1.5 inline-block transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                      ↗
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="hairline-t mt-16 flex flex-col items-start justify-between gap-4 pt-8 sm:flex-row sm:items-center">
          <div className="mono-label tracking-[0.24em]!">
            © {new Date().getFullYear()} MARCOVAULT — ALPHA, KEPT BEHIND STEEL
          </div>
          <div className="mono-label flex items-center gap-6">
            <span>EST. 2024</span>
            <span className="text-(--gold)">·</span>
            <button
              onClick={() => scrollToId("hero")}
              className="transition-colors duration-300 hover:text-(--bone)"
            >
              BACK TO TOP ↑
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
