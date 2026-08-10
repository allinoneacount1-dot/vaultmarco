import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/marco/Panel";
import { ShieldAlert, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/dashboard/rug-scanner")({
  component: RugScannerPage,
});

function RugScannerPage() {
  return (
    <div className="space-y-6">
      <motion.div 
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="mb-2 font-display text-[22px] font-semibold uppercase tracking-[0.04em] text-(--bone)">Rug Scanner</h1>
        <p className="text-muted-foreground">Token safety scanner powered by RugCheck</p>
      </motion.div>

      {/* Iframe RugCheck */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <Panel title="RUG SCANNER · POWERED BY RUGCHECK" icon={ShieldAlert}>
          <div className="flex flex-col gap-4">
            <motion.a
              href="https://rugcheck.xyz/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-(--gold) hover:text-(--gold)/80 text-sm font-medium"
            >
              <ExternalLink className="size-4" />
              Open RugCheck in new tab
            </motion.a>
            <div className="rounded-md overflow-hidden border border-(--hairline)">
              <iframe
                src="https://rugcheck.xyz/"
                title="RugCheck Token Scanner"
                className="w-full h-[800px] border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                referrerPolicy="strict-origin-when-cross-origin"
                loading="lazy"
              />
              <div className="p-4 border-t border-(--hairline)">
                <p className="text-xs text-muted-foreground">
                  Note: For full security features, it's recommended to use the "Open RugCheck in new tab" link above.
                </p>
              </div>
            </div>
          </div>
        </Panel>
      </motion.div>
    </div>
  );
}
