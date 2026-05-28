import { motion } from "framer-motion";
import { ArrowUpRight, Send, Target, Terminal as TerminalIcon, Twitter } from "lucide-react";
import { Terminal } from "./Terminal";
import logoUrl from "@/assets/marcovault-logo.png";

export function Hero() {
  return (
    <section id="home" className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
      {/* background grid + glow */}
      <div className="absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />

      {/* ghost emblem watermark — hidden on small screens to save bandwidth */}
      <motion.img
        src={logoUrl}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 0.05, scale: 1 }}
        transition={{ duration: 1.6, ease: "easeOut" }}
        className="hidden md:block pointer-events-none select-none absolute -top-20 left-1/2 -translate-x-1/2 w-[900px] lg:w-[1100px] max-w-none animate-float-y"
      />


      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* left */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 glass rounded-full pl-1.5 pr-3 py-1.5 mb-7"
            >
              <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium tracking-wider">
                LIVE
              </span>
              <span className="text-[11px] tracking-wider text-muted-foreground font-mono">
                MULTI-CHAIN OPS · ONLINE
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-chrome font-display font-semibold text-[44px] sm:text-[64px] lg:text-[80px] leading-[0.95] tracking-tight"
            >
              MARCO<br/>VAULT
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="mt-5 text-sm sm:text-base tracking-[0.18em] uppercase text-muted-foreground font-mono"
            >
              Multi-Chain Alpha · AI Workflows · Trading Systems
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed"
            >
              Navigating Web3 markets through multi-chain intelligence,
              AI-powered workflows, sniper infrastructure, and
              community-driven alpha. <span className="text-foreground">Navigate the noise. Enter the vault.</span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.55 }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <CTA
                href="https://t.me/DxmZone"
                primary
                icon={<Send className="size-3.5" />}
                ariaLabel="Join the MARCOVAULT Telegram community (opens in new tab)"
              >
                Join Telegram
              </CTA>
              <CTA
                href="https://x.com/vaultmarco"
                icon={<Twitter className="size-3.5" />}
                ariaLabel="Follow MARCOVAULT on X (opens in new tab)"
              >
                Follow on X
              </CTA>
              <a
                href="#ecosystem"
                className="text-[12px] font-medium uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors px-2"
              >
                Explore the vault ↓
              </a>
            </motion.div>

            {/* ticker */}
            <div
              className="mt-10 glass rounded-xl overflow-hidden"
              role="marquee"
              aria-label="Live market ticker — demo data"
            >
              <div className="flex whitespace-nowrap animate-ticker font-mono text-[11px] py-2.5">
                {Array.from({ length: 2 }).map((_, k) => (
                  <div key={k} className="flex items-center gap-8 px-4">
                    <span className="text-[9px] tracking-[0.3em] text-primary/70 uppercase">Demo</span>
                    {[
                      ["SOL", "+4.82%"], ["ETH", "+2.14%"], ["HYPE", "+12.3%"],
                      ["BTC", "+0.84%"], ["BASE", "+5.1%"], ["BNB", "-1.2%"],
                      ["SUI", "+8.4%"], ["TON", "+3.6%"], ["AVAX", "+1.9%"],
                    ].map(([s, v]) => (
                      <span key={s + k} className="flex items-center gap-2">
                        <span className="text-muted-foreground">{s}</span>
                        <span className={v.startsWith("-") ? "text-red-400" : "text-accent"}>{v}</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* right */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3 }}
            className="relative animate-float-y"
          >
            <Terminal />
            <div className="absolute -inset-8 bg-primary/10 blur-3xl -z-10 rounded-full" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function CTA({
  href,
  children,
  primary,
  icon,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`group relative inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[12px] font-medium uppercase tracking-[0.15em] transition-all overflow-hidden ${
        primary
          ? "bg-primary text-primary-foreground glow-cyan hover:scale-[1.03]"
          : "glass text-foreground hover:bg-white/8 border-glow"
      }`}
    >
      {icon}
      {children}
      <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </a>
  );
}
