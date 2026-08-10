import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Panel } from "@/components/marco/Panel";
import { Settings, Calculator, Zap, Copy, ExternalLink, Wallet } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/tools")({
  component: ToolsPage,
});

function ToolsPage() {
  // SAT to SOL converter
  const [satAmount, setSatAmount] = useState<string>("");
  const [solPrice, setSolPrice] = useState<string>("178.50");

  // Gas calculator
  const [gasLimit, setGasLimit] = useState<string>("21000");
  const [gasPriceGwei, setGasPriceGwei] = useState<string>("32");
  const [ethPrice, setEthPrice] = useState<string>("3650");

  // Token formatter
  const [tokenAmount, setTokenAmount] = useState<string>("");
  const [tokenDecimals, setTokenDecimals] = useState<string>("9");

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast("Copied to clipboard!");
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Calculations
  const solFromSat = satAmount ? (parseFloat(satAmount) / 100000000).toFixed(8) : "";
  const usdFromSol = solFromSat ? (parseFloat(solFromSat) * parseFloat(solPrice)).toFixed(2) : "";

  const ethFromGas = gasLimit && gasPriceGwei ? (parseFloat(gasLimit) * parseFloat(gasPriceGwei) / 1000000000).toFixed(8) : "";
  const usdFromGas = ethFromGas ? (parseFloat(ethFromGas) * parseFloat(ethPrice)).toFixed(4) : "";

  const tokenFromRaw = tokenAmount && tokenDecimals ? (parseFloat(tokenAmount) / Math.pow(10, parseInt(tokenDecimals))).toFixed(parseInt(tokenDecimals)) : "";

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 bg-primary text-background px-4 py-2 rounded-lg shadow-lg z-50 font-mono text-sm"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="mb-2 font-display text-[22px] font-semibold uppercase tracking-[0.04em] text-(--bone)">Tools</h1>
        <p className="text-muted-foreground">Useful utilities for crypto trading</p>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* SAT to SOL Converter */}
        <motion.div
          initial={{ opacity: 0, y: 20,  }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Panel title="SAT to SOL Converter" icon={Zap}>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground block mb-2">Amount in SAT</label>
                <input
                  type="number"
                  value={satAmount}
                  onChange={(e) => setSatAmount(e.target.value)}
                  placeholder="100000000"
                  className="w-full px-4 py-3 bg-background border border-(--hairline) rounded-md text-foreground focus:outline-none focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-2">SOL Price (USD)</label>
                <input
                  type="number"
                  value={solPrice}
                  onChange={(e) => setSolPrice(e.target.value)}
                  placeholder="178.50"
                  className="w-full px-4 py-3 bg-background border border-(--hairline) rounded-md text-foreground focus:outline-none focus:border-primary/50 transition-all"
                />
              </div>
              <div className="pt-4 border-t border-(--hairline) space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">SOL:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-mono">{solFromSat || "0"}</span>
                    {solFromSat && (
                      <motion.button
                        onClick={() => copyToClipboard(solFromSat)}
                        className="p-1 hover:bg-(--panel-2) rounded transition-all"
                      >
                        <Copy className="size-3 text-muted-foreground" />
                      </motion.button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">USD:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-(--up) font-mono">${usdFromSol || "0"}</span>
                    {usdFromSol && (
                      <motion.button
                        onClick={() => copyToClipboard(usdFromSol)}
                        className="p-1 hover:bg-(--panel-2) rounded transition-all"
                      >
                        <Copy className="size-3 text-muted-foreground" />
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </motion.div>

        {/* Gas Calculator */}
        <motion.div
          initial={{ opacity: 0, y: 20,  }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Panel title="Gas Calculator" icon={Calculator}>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground block mb-2">Gas Limit</label>
                <input
                  type="number"
                  value={gasLimit}
                  onChange={(e) => setGasLimit(e.target.value)}
                  placeholder="21000"
                  className="w-full px-4 py-3 bg-background border border-(--hairline) rounded-md text-foreground focus:outline-none focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-2">Gas Price (Gwei)</label>
                <input
                  type="number"
                  value={gasPriceGwei}
                  onChange={(e) => setGasPriceGwei(e.target.value)}
                  placeholder="32"
                  className="w-full px-4 py-3 bg-background border border-(--hairline) rounded-md text-foreground focus:outline-none focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-2">ETH Price (USD)</label>
                <input
                  type="number"
                  value={ethPrice}
                  onChange={(e) => setEthPrice(e.target.value)}
                  placeholder="3650"
                  className="w-full px-4 py-3 bg-background border border-(--hairline) rounded-md text-foreground focus:outline-none focus:border-primary/50 transition-all"
                />
              </div>
              <div className="pt-4 border-t border-(--hairline) space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">ETH:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-mono">{ethFromGas || "0"}</span>
                    {ethFromGas && (
                      <motion.button
                        onClick={() => copyToClipboard(ethFromGas)}
                        className="p-1 hover:bg-(--panel-2) rounded transition-all"
                      >
                        <Copy className="size-3 text-muted-foreground" />
                      </motion.button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">USD:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-(--up) font-mono">${usdFromGas || "0"}</span>
                    {usdFromGas && (
                      <motion.button
                        onClick={() => copyToClipboard(usdFromGas)}
                        className="p-1 hover:bg-(--panel-2) rounded transition-all"
                      >
                        <Copy className="size-3 text-muted-foreground" />
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </motion.div>

        {/* Token Decimal Converter */}
        <motion.div
          initial={{ opacity: 0, y: 20,  }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Panel title="Token Decimal Converter" icon={Settings}>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground block mb-2">Raw Amount (wei/lampsorts)</label>
                <input
                  type="number"
                  value={tokenAmount}
                  onChange={(e) => setTokenAmount(e.target.value)}
                  placeholder="1000000000"
                  className="w-full px-4 py-3 bg-background border border-(--hairline) rounded-md text-foreground focus:outline-none focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-2">Token Decimals</label>
                <input
                  type="number"
                  value={tokenDecimals}
                  onChange={(e) => setTokenDecimals(e.target.value)}
                  placeholder="9"
                  min="0"
                  max="18"
                  className="w-full px-4 py-3 bg-background border border-(--hairline) rounded-md text-foreground focus:outline-none focus:border-primary/50 transition-all"
                />
              </div>
              <div className="pt-4 border-t border-(--hairline)">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Formatted Amount:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-mono">{tokenFromRaw || "0"}</span>
                    {tokenFromRaw && (
                      <motion.button
                        onClick={() => copyToClipboard(tokenFromRaw)}
                        className="p-1 hover:bg-(--panel-2) rounded transition-all"
                      >
                        <Copy className="size-3 text-muted-foreground" />
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </motion.div>

        {/* Quick Links */}
        <motion.div
          initial={{ opacity: 0, y: 20,  }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Panel title="Quick Links" icon={ExternalLink}>
            <div className="space-y-2">
              {[
                { href: "https://solscan.io", label: "Solscan", desc: "Solana Explorer", color: "purple", initial: "SL" },
                { href: "https://etherscan.io", label: "Etherscan", desc: "Ethereum Explorer", color: "blue", initial: "ES" },
                { href: "https://dexscreener.com", label: "DexScreener", desc: "DEX Charts", color: "primary", initial: "DS" },
                { href: "https://www.dextools.io", label: "DexTools", desc: "DEX Analysis", color: "violet", initial: "DT" },
                { href: "https://trade.padre.gg/rk/dexmultichain", label: "Padre Trade", desc: "Multichain DEX", color: "green", initial: "PT" },
                { href: "https://t.me/achilles_trojanbot?start=r-oxjackpot", label: "Achilles Trojan Bot", desc: "Telegram Sniper", color: "cyan", initial: "AT" }
              ].map((link, i) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
                  className="flex items-center gap-3 p-3 rounded-md border border-(--hairline) hover:bg-(--panel-2) transition-all"
                >
                  <div className={`w-10 h-10 rounded-full bg-${link.color}-500/20 flex items-center justify-center`}>
                    <span className={`text-${link.color}-400 font-bold text-xs`}>{link.initial}</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-foreground font-medium">{link.label}</div>
                    <div className="text-muted-foreground text-xs">{link.desc}</div>
                  </div>
                  <ExternalLink className="size-4 text-muted-foreground" />
                </motion.a>
              ))}
            </div>
          </Panel>
        </motion.div>
      </div>

      {/* Additional Tools Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.8 }}
      >
        <Panel title="More Tools" icon={Wallet}>
          <div className="grid md:grid-cols-3 gap-4">
            {["Portfolio Tracker", "Price Alerts", "Sniper Bot"].map((tool, i) => (
              <motion.button
                key={tool}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.9 + i * 0.1 }}
                className="p-4 rounded-md border border-(--hairline) hover:bg-(--panel-2) transition-all text-left"
              >
                <div className="text-foreground font-medium mb-1">{tool}</div>
                <div className="text-muted-foreground text-sm">Coming soon</div>
              </motion.button>
            ))}
          </div>
        </Panel>
      </motion.div>
    </div>
  );
}
