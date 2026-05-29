import { motion } from "framer-motion";
import { ArrowUpRight, Send, Twitter, Terminal as TerminalIcon } from "lucide-react";
import { SectionHeader, fadeUp } from "./SectionHeader";
import { ContactForm } from "./ContactForm";

export function Contact() {
  return (
    <section id="contact" className="relative py-24 sm:py-32">
      <div className="absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[500px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
        <motion.div {...fadeUp} className="text-center">
          <div className="inline-flex items-center gap-2 text-[10px] font-mono tracking-[0.35em] text-primary mb-4">
            <span className="size-1 rounded-full bg-primary animate-pulse-glow" />
            06 / ENTER
          </div>
          <h2 className="text-chrome font-display text-5xl sm:text-7xl font-semibold tracking-tight">
            Enter The Vault.
          </h2>
          <p className="mt-5 text-muted-foreground max-w-xl mx-auto">
            Join the ecosystem and stay ahead of the next market narrative.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="https://t.me/DxmZone"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-3 text-[12px] font-medium uppercase tracking-[0.18em] glow-cyan hover:scale-[1.03] transition-transform"
            >
              <Send className="size-3.5" /> Join Telegram
            </a>
            <a
              href="https://x.com/vaultmarco"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full glass border-glow px-5 py-3 text-[12px] font-medium uppercase tracking-[0.18em] hover:bg-white/8 transition-colors"
            >
              <Twitter className="size-3.5" /> Follow on X
            </a>
            <a
              href="https://trade.padre.gg/rk/dexmultichain"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full glass border-glow px-5 py-3 text-[12px] font-medium uppercase tracking-[0.18em] hover:bg-white/8 transition-colors"
            >
              <TerminalIcon className="size-3.5" /> Open Terminal
            </a>
          </div>
        </motion.div>

        <ContactForm />
      </div>
    </section>
  );
}
