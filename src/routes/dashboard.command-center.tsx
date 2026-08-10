import { createFileRoute } from "@tanstack/react-router";
import { CommandCenter } from "@/components/marco/CommandCenter";
import { motion } from "framer-motion";

export const Route = createFileRoute("/dashboard/command-center")({
  component: CommandCenterPage,
});

function CommandCenterPage() {
  return (
    <div className="space-y-6">
      <motion.div 
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="mb-2 font-display text-[22px] font-semibold uppercase tracking-[0.04em] text-(--bone)">Command Center</h1>
        <p className="text-muted-foreground">04 / COMMAND CENTER - Inside The Vault</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <CommandCenter />
      </motion.div>
    </div>
  );
}
