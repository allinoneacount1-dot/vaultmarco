import { motion } from "framer-motion";
import { Hexagon, Twitter, MessageCircle } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-white/5 py-12 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="text-primary"
              animate={{
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Hexagon className="size-5" />
            </motion.div>
            <span className="font-display text-foreground">Marco</span>
            <span className="text-muted-foreground text-xs">v1.0</span>
          </motion.div>

          <motion.div
            className="flex items-center gap-5 text-muted-foreground"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <motion.a
              href="https://x.com/dexmultichain"
              target="_blank"
              rel="noreferrer"
              className="hover:text-primary transition-colors"
              whileHover={{ scale: 1.2, color: "#91E7FF" }}
              whileTap={{ scale: 0.9 }}
            >
              <Twitter className="size-4" />
            </motion.a>
            <motion.a
              href="https://t.me/DxmZone"
              target="_blank"
              rel="noreferrer"
              className="hover:text-primary transition-colors"
              whileHover={{ scale: 1.2, color: "#91E7FF" }}
              whileTap={{ scale: 0.9 }}
            >
              <MessageCircle className="size-4" />
            </motion.a>
          </motion.div>

          <motion.div
            className="text-[11px] font-mono tracking-[0.2em] text-muted-foreground uppercase"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            © {new Date().getFullYear()} Marco. All rights reserved.
          </motion.div>
        </div>
      </div>
    </footer>
  );
}
