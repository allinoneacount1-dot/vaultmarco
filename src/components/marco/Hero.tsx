import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Send, Twitter } from "lucide-react";
import { Terminal } from "./Terminal";
import { LiveTicker } from "./LiveTicker";
import logoUrl from "@/assets/marcovault-logo.png";
import { MagneticButton } from "./MagneticButton";

export function Hero() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="home" className="relative pt-24 sm:pt-32 pb-16 sm:pb-20 md:pb-28 overflow-hidden">
      {/* background grid + glow */}
      <div className="absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      {!shouldReduceMotion && (
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] sm:w-[600px] sm:h-[600px] rounded-full bg-primary/10 blur-[80px] sm:blur-[120px] pointer-events-none"
          style={{ willChange: "transform, opacity" }}
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.3, 0.45, 0.3],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
      {shouldReduceMotion && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] sm:w-[600px] sm:h-[600px] rounded-full bg-primary/10 blur-[80px] sm:blur-[120px] pointer-events-none opacity-30" />
      )}

      {/* ghost emblem watermark — hidden on small screens to save bandwidth */}
      <motion.img
        src={logoUrl}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 0.05, scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="hidden md:block pointer-events-none select-none absolute -top-20 left-1/2 -translate-x-1/2 w-[900px] lg:w-[1100px] max-w-none"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-8 items-center">
          {/* left */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              style={{ willChange: "transform, opacity" }}
              className="inline-flex items-center gap-2 glass rounded-full pl-1.5 pr-3 py-1.5 mb-6"
            >
              <motion.span
                className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium tracking-wider"
                animate={shouldReduceMotion ? {} : {
                  scale: [1, 1.03, 1],
                  boxShadow: [
                    "0 0 6px rgba(145,231,255,0.3)",
                    "0 0 12px rgba(145,231,255,0.5)",
                    "0 0 6px rgba(145,231,255,0.3)",
                  ],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{ willChange: "transform, box-shadow" }}
              >
                LIVE
              </motion.span>
              <span className="text-[11px] tracking-wider text-muted-foreground font-mono">
                MULTI-CHAIN OPS · ONLINE
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              style={{ willChange: "transform, opacity" }}
              className="text-chrome font-display font-semibold text-[36px] sm:text-[44px] md:text-[56px] lg:text-[80px] leading-[0.95] tracking-tight"
            >
              <motion.span
                className="inline-block"
                animate={shouldReduceMotion ? {} : {
                  y: [0, -2, 0],
                  textShadow: [
                    "0 0 12px rgba(145,231,255,0.3)",
                    "0 0 25px rgba(145,231,255,0.5)",
                    "0 0 12px rgba(145,231,255,0.3)",
                  ],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{ willChange: "transform, text-shadow" }}
              >
                MARCO
              </motion.span>
              <br />
              <motion.span
                className="inline-block"
                animate={shouldReduceMotion ? {} : {
                  y: [0, -2, 0],
                  textShadow: [
                    "0 0 12px rgba(145,231,255,0.3)",
                    "0 0 25px rgba(145,231,255,0.5)",
                    "0 0 12px rgba(145,231,255,0.3)",
                  ],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.5,
                }}
                style={{ willChange: "transform, text-shadow" }}
              >
                VAULT
              </motion.span>
              <span className="block mt-3 sm:mt-4 text-[14px] sm:text-[16px] lg:text-[24px] text-muted-foreground font-normal tracking-normal">
                Multi-Chain Alpha & Web3 Intelligence Platform
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              style={{ willChange: "opacity" }}
              className="mt-4 sm:mt-5 text-xs sm:text-sm tracking-[0.18em] uppercase text-muted-foreground font-mono"
            >
              Multi-Chain Alpha · AI Workflows · Trading Systems
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              style={{ willChange: "opacity" }}
              className="mt-4 sm:mt-5 text-sm sm:text-base text-muted-foreground max-w-xl leading-relaxed"
            >
              Navigating Web3 markets through multi-chain intelligence, AI-powered workflows, sniper
              infrastructure, and community-driven alpha.{" "}
              <motion.span
                className="text-foreground inline-block"
                animate={shouldReduceMotion ? {} : {
                  color: ["#E5E5E5", "#91E7FF", "#E5E5E5"],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{ willChange: "color" }}
              >
                Navigate the noise. Enter the vault.
              </motion.span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55 }}
              style={{ willChange: "transform, opacity" }}
              className="mt-7 sm:mt-9 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3"
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
              <motion.a
                href="#ecosystem"
                className="text-[12px] font-medium uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 sm:py-0 text-center"
                whileHover={{ scale: 1.03, color: "#91E7FF" }}
                whileTap={{ scale: 0.97 }}
                style={{ willChange: "transform" }}
              >
                Explore the vault ↓
              </motion.a>
            </motion.div>

            <LiveTicker />
          </div>

          {/* right */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            style={{ willChange: "transform, opacity" }}
            className="relative mt-6 lg:mt-0"
          >
            <Terminal />
            {!shouldReduceMotion && (
              <motion.div
                className="absolute -inset-6 sm:-inset-8 bg-primary/10 blur-3xl -z-10 rounded-full"
                style={{ willChange: "transform, opacity" }}
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.2, 0.35, 0.2],
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            )}
            {shouldReduceMotion && (
              <div className="absolute -inset-6 sm:-inset-8 bg-primary/10 blur-3xl -z-10 rounded-full opacity-25" />
            )}
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
  ariaLabel,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
  icon?: React.ReactNode;
  ariaLabel?: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <a href={href} target="_blank" rel="noreferrer" aria-label={ariaLabel}>
      <MagneticButton
        className={`group relative inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[12px] font-medium uppercase tracking-[0.15em] transition-all overflow-hidden ${
          primary
            ? "bg-primary text-primary-foreground glow-cyan hover:scale-[1.02]"
            : "glass text-foreground hover:bg-white/8 border-glow"
        }`}
      >
        {icon && (
          <motion.span
            animate={shouldReduceMotion ? {} : {
              rotate: [0, 6, -6, 0],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ willChange: "transform" }}
          >
            {icon}
          </motion.span>
        )}
        {children}
        <motion.span
          animate={shouldReduceMotion ? {} : {
            x: [0, 3, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{ willChange: "transform" }}
        >
          <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </motion.span>
      </MagneticButton>
    </a>
  );
}
