import { useEffect, useState } from "react";
import { Menu, X, Wallet } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { WhaleAlertIcon } from "./WhaleAlertIcon";
import { ThemeToggle } from "./ThemeToggle";
import { GasTracker } from "./GasTracker";

const links = [
  { label: "Home", href: "#home" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "About", href: "#about" },
  { label: "Ecosystem", href: "#ecosystem" },
  { label: "Tools", href: "#tools" },
  { label: "Partnerships", href: "#partnerships" },
  { label: "Contact", href: "#contact" },
  { label: "FAQ", href: "#faq" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled ? "py-3" : "py-5"
      }`}
    >
      <div
        className={`mx-auto max-w-7xl px-4 sm:px-6 transition-all duration-500 ${
          scrolled ? "" : ""
        }`}
      >
        <div
          className={`flex items-center justify-between rounded-2xl px-4 sm:px-5 py-3 transition-all duration-500 ${
            scrolled ? "glass-strong" : "border border-transparent"
          }`}
        >
          <Link to="/" hash="home" className="flex items-center">
            <Logo />
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            {links.map((l) => (
              l.href.startsWith("/") ? (
                <Link
                  key={l.href}
                  to={l.href}
                  className="text-[13px] tracking-wide text-muted-foreground hover:text-foreground transition-colors relative group"
                >
                  {l.label}
                  <span className="absolute -bottom-1 left-0 h-px w-0 group-hover:w-full bg-primary transition-all duration-300" />
                </Link>
              ) : (
                <a
                  key={l.href}
                  href={l.href}
                  className="text-[13px] tracking-wide text-muted-foreground hover:text-foreground transition-colors relative group"
                >
                  {l.label}
                  <span className="absolute -bottom-1 left-0 h-px w-0 group-hover:w-full bg-primary transition-all duration-300" />
                </a>
              )
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <GasTracker />
            <WhaleAlertIcon />
            <ThemeToggle />
            <ConnectButton.Custom>
              {({ account, chain, openConnectModal, mounted }) => {
                if (!mounted) return null;

                if (!account) {
                  return (
                    <button
                      onClick={openConnectModal}
                      className="group relative inline-flex items-center gap-2 rounded-full bg-primary px-3 sm:px-4 py-1.5 sm:py-2 text-[12px] font-medium text-primary-foreground tracking-wider uppercase transition-all hover:scale-[1.02] glow-cyan overflow-hidden"
                    >
                      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover:animate-sweep" />
                      <Wallet className="size-3.5" />
                      Connect Wallet
                    </button>
                  );
                }

                return <ConnectButton />;
              }}
            </ConnectButton.Custom>
            <a
              href="https://t.me/DxmZone"
              target="_blank"
              rel="noreferrer"
              className="hidden lg:flex group relative inline-flex items-center gap-2 rounded-full bg-primary px-3 sm:px-4 py-1.5 sm:py-2 text-[12px] font-medium text-primary-foreground tracking-wider uppercase transition-all hover:scale-[1.02] glow-cyan overflow-hidden"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover:animate-sweep" />
              Join Community
              <span className="size-1.5 rounded-full bg-primary-foreground animate-pulse-glow" />
            </a>
          </div>

          <button
            className="md:hidden grid place-items-center size-9 rounded-lg glass"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>

        {open && (
          <div className="md:hidden mt-2 glass-strong rounded-2xl p-4 animate-fade-in">
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                l.href.startsWith("/") ? (
                  <Link
                    key={l.href}
                    to={l.href}
                    onClick={() => setOpen(false)}
                    className="px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                ) : (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  >
                    {l.label}
                  </a>
                )
              ))}
              <div className="mt-3">
                <ConnectButton.Custom>
                  {({ account, chain, openConnectModal, mounted }) => {
                    if (!mounted) return null;

                    if (!account) {
                      return (
                        <button
                          onClick={openConnectModal}
                          className="w-full group relative inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground tracking-wider uppercase transition-all hover:scale-[1.02] glow-cyan overflow-hidden"
                        >
                          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover:animate-sweep" />
                          <Wallet className="size-3.5" />
                          Connect Wallet
                        </button>
                      );
                    }

                    return <ConnectButton />;
                  }}
                </ConnectButton.Custom>
              </div>
              <a
                href="https://t.me/DxmZone"
                target="_blank"
                rel="noreferrer"
                className="mt-2 text-center bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium uppercase tracking-wider"
              >
                Join Community
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
