import { X, Search, ShieldAlert, ShieldCheck, Activity } from "lucide-react";

interface RugScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: { sym: string; name: string } | null;
}

// Mock rug scan data
const mockRugScan = (tokenSym: string) => {
  // Generate random score for demo
  const score = Math.floor(Math.random() * 100);
  return {
    score,
    checks: [
      { name: "Liquidity Locked", passed: Math.random() > 0.3 },
      { name: "Contract Renounced", passed: Math.random() > 0.5 },
      { name: "Top 10 Holders < 50%", passed: Math.random() > 0.4 },
      { name: "No Honeypot", passed: Math.random() > 0.2 },
      { name: "Verified Contract", passed: Math.random() > 0.3 },
    ],
  };
};

export function RugScannerModal({ isOpen, onClose, token }: RugScannerModalProps) {
  if (!isOpen || !token) return null;
  const scanResult = mockRugScan(token.sym);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-strong border-glow rounded-3xl p-6 w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
          <div>
            <div className="text-[11px] font-mono tracking-wider text-primary">RUG SCANNER</div>
            <div className="text-lg font-display text-chrome mt-1">
              {token.sym} - {token.name}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        {/* Score Display */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">SAFETY SCORE</div>
            <div
              className={`text-4xl font-display ${scanResult.score > 70 ? "text-accent" : scanResult.score > 40 ? "text-yellow-400" : "text-red-400"}`}
            >
              {scanResult.score}/100
            </div>
          </div>
          {scanResult.score > 70 ? (
            <ShieldCheck className="size-12 text-accent" />
          ) : (
            <ShieldAlert className="size-12 text-red-400" />
          )}
        </div>

        {/* Checks List */}
        <div className="space-y-2">
          {scanResult.checks.map((check, i) => (
            <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-white/5">
              <div className="flex items-center gap-2">
                <Activity className={`size-3 ${check.passed ? "text-accent" : "text-red-400"}`} />
                <div className="text-[12px] text-foreground">{check.name}</div>
              </div>
              <div
                className={`text-[11px] font-mono ${check.passed ? "text-accent" : "text-red-400"}`}
              >
                {check.passed ? "PASS" : "FAIL"}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full group relative inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[12px] font-medium text-primary-foreground tracking-wider uppercase transition-all hover:scale-[1.02] glow-cyan overflow-hidden"
        >
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover:animate-sweep" />
          Close Scanner
        </button>
      </div>
    </div>
  );
}
