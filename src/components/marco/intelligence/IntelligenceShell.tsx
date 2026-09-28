import { useRef, useState } from "react";
import { Crosshair, X } from "lucide-react";
import { SearchDialog } from "@/components/marco/GlobalSearch";
import { StateDot } from "@/components/marco/desk";
import { useFocusAsset } from "@/hooks/useFocusAsset";
import { useAssetFreshness, useAssetTrack, useSessionInfo } from "@/hooks/useIntelligence";
import {
  FRESHNESS_TEXT,
  ageLabel,
  clockLabel,
  freshnessDeskState,
  type AssetFreshness,
} from "@/lib/intelligence/freshness";
import { normalizeChain } from "@/lib/providers/dexscreener";
import { shortAddress } from "@/lib/search";
import { type IntelligenceFeature, featureById } from "./features";
import { RecordingSince } from "./shared/RecordingSince";

/**
 * INTELLIGENCE SHELL — the frame every intelligence view shares, so the six
 * pages read as one system: the view's one question, the selected asset
 * (identity from the URL), and the truth about how fresh that asset's
 * evidence is. It holds no market logic.
 */
export function IntelligenceShell({
  feature,
  children,
}: {
  feature: IntelligenceFeature["id"];
  children: React.ReactNode;
}) {
  const f = featureById(feature);
  return (
    <div className="space-y-6 lg:space-y-8" data-testid="intel-shell" data-feature={f.id}>
      <header className="space-y-2">
        <p className="mono-label text-[9px]!">
          <span className="text-(--muted-2)">INTELLIGENCE</span> · {f.label.toUpperCase()}
        </p>
        <h1
          className="font-display text-[20px] font-semibold uppercase tracking-[0.04em] text-(--bone) lg:text-[24px]"
          data-testid="intel-question"
        >
          {f.question}
        </h1>
      </header>
      {/* Unfocused views (the Change Queue) state recording in their own status line. */}
      {f.focused && <AssetBar />}
      {children}
    </div>
  );
}

/**
 * When the session's history comes from: the recorder's own mount time (and
 * its pauses), never app boot. "OBSERVED THIS SESSION ONLY".
 */
function SessionLine() {
  const { retainedSince } = useSessionInfo();
  return (
    <p
      className="font-mono text-[10px] tracking-[0.14em] text-(--faint)"
      data-testid="session-line"
    >
      <RecordingSince />
      {retainedSince == null ? " · NO OBSERVATIONS YET" : " · OBSERVED THIS SESSION ONLY"}
    </p>
  );
}

const INVALID_TEXT: Record<string, string> = {
  MISSING_CHAIN: "missing chain",
  MISSING_ADDRESS: "missing address",
  INVALID_CHAIN: "invalid chain",
  INVALID_ADDRESS: "not a contract address (symbols are not identities)",
};

/** The selected asset: identity, SELECT ASSET, and its evidence freshness. */
function AssetBar() {
  const { focus, invalid, setFocus } = useFocusAsset();
  const track = useAssetTrack(focus?.assetKey);
  const fresh = useAssetFreshness(focus?.assetKey);
  const latest = track?.observations[track.observations.length - 1] ?? null;
  const symbol = latest?.snapshot.baseSymbol ?? null;
  // Display the provider's original address when observed; else the URL's.
  const address = latest?.address ?? focus?.address ?? null;
  // Pool = evidence of the latest observation, never a scope from the URL.
  const pool = latest?.pairAddress ?? null;
  const dex = latest?.snapshot.dexId ?? null;

  return (
    <section
      aria-label="Selected asset"
      className="hairline-t hairline-b flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
      data-testid="asset-bar"
      data-key={focus?.assetKey ?? ""}
    >
      <div className="min-w-0 space-y-1.5">
        {focus ? (
          <div
            className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
            data-testid="focus-identity"
          >
            <span className="mv-chip shrink-0 text-(--bone)">
              {normalizeChain(focus.chainId).toUpperCase()}
            </span>
            <span className="font-mono text-[13px] font-semibold text-(--bone)">
              {symbol ?? (address ? shortAddress(address) : "—")}
            </span>
            {address && (
              <span className="font-mono text-[10px] text-(--faint)" title={address}>
                {shortAddress(address)}
              </span>
            )}
            {pool && (
              <span
                className="font-mono text-[10px] text-(--faint)"
                title={`Observed pool ${pool} — the provider's pool for this asset in the latest observation; it may change between rounds.`}
                data-testid="observed-pool"
              >
                OBSERVED POOL {shortAddress(pool)}
                {dex ? ` · ${dex.toUpperCase()}` : ""}
              </span>
            )}
          </div>
        ) : (
          <p
            className="font-mono text-[11px] tracking-[0.14em] text-(--muted-2)"
            data-testid="focus-identity"
          >
            {invalid
              ? `ASSET IN URL REJECTED — ${INVALID_TEXT[invalid] ?? invalid}`
              : "NO ASSET SELECTED"}
          </p>
        )}
        {focus && <FreshnessLine fresh={fresh} lanes={latest?.lanes ?? []} />}
        {/* Where the history comes from matters when there is little or none, or it is not current. */}
        {(!focus || (fresh.state !== "live" && fresh.state !== "degraded")) && <SessionLine />}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <AssetPicker onPick={(chainId, addr) => setFocus({ chainId, address: addr })} />
        {focus && (
          <button
            type="button"
            onClick={() => setFocus(null)}
            className="mv-glass-icon grid size-9 place-items-center text-(--muted-2)"
            aria-label="Clear selected asset"
            data-testid="clear-asset"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
    </section>
  );
}

function FreshnessLine({ fresh, lanes }: { fresh: AssetFreshness; lanes: string[] }) {
  const dot = freshnessDeskState(fresh.state);
  const text =
    fresh.state === "unobserved"
      ? "NOT IN OBSERVED UNIVERSE"
      : fresh.observedAt == null
        ? FRESHNESS_TEXT[fresh.state]
        : `${FRESHNESS_TEXT[fresh.state]} · OBSERVED ${clockLabel(fresh.observedAt)} · ${ageLabel(fresh.ageMs)} AGO · DEXSCREENER ${lanes
            .map((l) => l.toUpperCase())
            .join(" + ")}`;
  return (
    <p
      className="flex items-center gap-2 font-mono text-[10px] tracking-[0.14em] text-(--muted-2)"
      data-testid="focus-freshness"
      data-state={fresh.state}
    >
      {dot && (
        <StateDot
          state={dot}
          className={
            dot === "live"
              ? "text-(--gold)"
              : dot === "offline"
                ? "text-(--down)"
                : "text-(--champagne)"
          }
        />
      )}
      <span>{text}</span>
    </p>
  );
}

/** SELECT ASSET — Global Search's own index and ranking, used as a picker. */
function AssetPicker({ onPick }: { onPick: (chainId: string, address: string) => void }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="mv-glass flex h-9 items-center gap-2 px-3 text-(--muted-2)"
        data-testid="select-asset"
      >
        <Crosshair className="size-3.5" aria-hidden />
        <span className="mono-label text-[9px]!">SELECT ASSET</span>
      </button>
      <SearchDialog
        open={open}
        onOpenChange={setOpen}
        trigger={trigger}
        description="Select an asset MARCOVAULT currently holds, by symbol, name, contract address, chain or source. The selection is kept in the page address by chain and contract."
        onChoose={(entry) => onPick(entry.chainId, entry.address)}
      />
    </>
  );
}
