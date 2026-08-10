import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Faq } from "@/components/marco/Faq";

export const Route = createFileRoute("/dashboard/faq")({
  component: FaqPage,
});

function FaqPage() {
  return (
    <div className="space-y-6">
      <motion.div 
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="mb-2 font-display text-[22px] font-semibold uppercase tracking-[0.04em] text-(--bone)">FAQ</h1>
        <p className="text-muted-foreground">07 / FAQ - Frequently Asked Questions</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <Faq />
      </motion.div>
    </div>
  );
}
