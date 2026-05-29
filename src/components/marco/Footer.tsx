import {
  ArrowUpRight,
  Globe,
  Twitter,
  MessageCircle,
  Terminal as TerminalIcon,
} from "lucide-react";

export function Footer() {
  return (
    <footer className="relative pt-16 pb-10 border-t border-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-2">
            <div className="font-display font-semibold text-chrome text-xl tracking-[0.18em]">
              MARCOVAULT
            </div>
            <p className="mt-4 text-sm text-muted-foreground max-w-sm leading-relaxed">
              Built for the next generation of Web3 operators. Multi-chain alpha, AI workflows and
              sniper-grade execution.
            </p>
          </div>

          <div>
            <div className="text-[10px] font-mono tracking-[0.3em] text-muted-foreground mb-4">
              NAVIGATE
            </div>
            <ul className="space-y-2 text-sm">
              {["About", "Ecosystem", "Tools", "Partnerships", "Watchlist", "Contact", "FAQ"].map(
                (l) => (
                  <li key={l}>
                    <a
                      href={`#${l.toLowerCase()}`}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {l}
                    </a>
                  </li>
                ),
              )}
            </ul>
          </div>

          <div>
            <div className="text-[10px] font-mono tracking-[0.3em] text-muted-foreground mb-4">
              CONNECT
            </div>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://x.com/vaultmarco"
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  X / Twitter
                </a>
              </li>
              <li>
                <a
                  href="https://t.me/DxmZone"
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Telegram Group
                </a>
              </li>
              <li>
                <a
                  href="https://t.me/DexMultichain"
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Telegram Channel
                </a>
              </li>
              <li>
                <a
                  href="https://trade.padre.gg/rk/dexmultichain"
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                >
                  Padre Terminal <ArrowUpRight className="size-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://t.me/achilles_trojanbot?start=r-oxjackpot"
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                >
                  Sniper Bot <ArrowUpRight className="size-3" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-[11px] font-mono tracking-[0.2em] text-muted-foreground uppercase">
            © {new Date().getFullYear()} MARCOVAULT · All rights reserved
          </div>
          <div className="text-[11px] font-mono tracking-[0.2em] text-primary uppercase">
            Built For The Next Generation Of Web3 Operators
          </div>
        </div>
      </div>
    </footer>
  );
}
