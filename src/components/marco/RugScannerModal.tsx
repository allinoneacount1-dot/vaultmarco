import { X, ShieldAlert, ShieldCheck, Activity, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type Check = {
  name: string;
  passed: boolean;
};

type ScanResult = {
  symbol: string;
  score: number;
  checks: Check[];
};

interface RugScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: { sym: string; name: string } | null;
}

export function RugScannerModal({ isOpen, onClose, token }: RugScannerModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["rugScan", token?.sym],
    queryFn: async () => {
      if (!token) return null;
      const res = await fetch(`/api/rug/scan?symbol=${token.sym}`);
      return res.json() as ScanResult;
    },
    enabled: !!token,
  });

  if (!isOpen || !token) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="hairline bg-(--panel) rounded-lg p-6 w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-(--hairline)">
          <div>
            <div className="text-[11px] font-mono tracking-wider text-(--gold)">RUG SCANNER</div>
            <div className="text-lg font-display chrome-text mt-1">
              {token.sym} - {token.name}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="size-10 text-(--up) animate-spin mb-4" />
            <div className="text-[12px] text-muted-foreground font-mono">Scanning token...</div>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-muted-foreground mb-1">SAFETY SCORE</div>
                <div
                  className={`text-4xl font-display ${
                    data?.score && data.score > 70
                      ? "text-(--up)"
                      : data?.score && data.score > 40
                        ? "text-(--gold)"
                        : "text-(--down)"
                  }`}
                >
                  {data?.score || 0}/100
                </div>
              </div>
              {data?.score && data.score > 70 ? (
                <ShieldCheck className="size-12 text-(--up)" />
              ) : (
                <ShieldAlert className="size-12 text-(--down)" />
              )}
            </div>

            <div className="space-y-2">
              {data?.checks?.map((check: Check, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded-md bg-(--panel-2)"
                >
                  <div className="flex items-center gap-2">
                    <Activity
                      className={`size-3 ${check.passed ? "text-(--up)" : "text-(--down)"}`}
                    />
                    <div className="text-[12px] text-foreground">{check.name}</div>
                  </div>
                  <div
                    className={`text-[11px] font-mono ${
                      check.passed ? "text-(--up)" : "text-(--down)"
                    }`}
                  >
                    {check.passed ? "PASS" : "FAIL"}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full group relative inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[12px] font-medium text-primary-foreground tracking-wider uppercase transition-all hover:scale-[1.02] overflow-hidden"
        >
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover:" />
          Close Scanner
        </button>
      </div>
    </div>
  );
}
