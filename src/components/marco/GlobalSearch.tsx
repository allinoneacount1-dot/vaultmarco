import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { type QueryState, useQueryClient } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { PAIR_UNIVERSE_KEY, radarHistory, resolveRadarStatus } from "@/hooks/usePairUniverse";
import { useTokenDrawerActions } from "@/hooks/useTokenDrawer";
import { formatNumber } from "@/components/marco/shared/helpers";
import { normalizeChain } from "@/lib/providers/dexscreener";
import type { PairUniverse } from "@/lib/providers/universe";
import {
  type RadarSignal,
  type SearchEntry,
  type SearchResult,
  TIER_LABEL,
  buildSearchIndex,
  searchIndex,
  shortAddress,
} from "@/lib/search";

/**
 * GLOBAL SEARCH — Cmd/Ctrl+K palette over data MARCOVAULT already holds.
 *
 * Network: none. The index is read from the Pair Universe query CACHE
 * (`getQueryData` + a cache subscription while open) — never through a new
 * `useQuery` observer, which would refetch a stale query on mount. Opening,
 * typing and closing issue zero requests; selecting a result opens the
 * already-mounted Token Intelligence Drawer.
 */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey)
        return;
      e.preventDefault();
      if (!e.repeat) setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        className="mv-glass flex h-8 items-center gap-2 px-2 text-(--muted-2) sm:px-3"
      >
        <Search className="size-3.5" aria-hidden />
        <span className="mono-label hidden text-[9px]! sm:inline">SEARCH</span>
        <span className="sr-only sm:hidden">Search</span>
        <kbd className="hidden font-mono text-[9px] text-(--faint) md:inline">
          {isMac() ? "⌘K" : "CTRL K"}
        </kbd>
      </button>
      <SearchDialog open={open} onOpenChange={setOpen} trigger={triggerRef} />
    </>
  );
}

/** The active option: the chosen key if it is still listed, else the first result. */
function activeIndex(results: readonly SearchResult[], key: string | null): number {
  if (results.length === 0) return -1;
  const i = results.findIndex((r) => r.entry.key === key);
  return i >= 0 ? i : 0;
}

function isMac() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
}

/**
 * The Pair Universe query's cached state right now (data + fetch status);
 * re-reads only while `active`. Reading the state — not just the data — lets
 * Search apply the same temporal-truth rule as the radar and the drawer.
 */
function useCachedUniverseState(active: boolean): QueryState<PairUniverse> | undefined {
  const queryClient = useQueryClient();
  const subscribe = useCallback(
    (onChange: () => void) =>
      active
        ? queryClient.getQueryCache().subscribe((event) => {
            if (event.query.queryKey[0] === PAIR_UNIVERSE_KEY[0]) onChange();
          })
        : () => {},
    [queryClient, active],
  );
  return useSyncExternalStore(
    subscribe,
    () => queryClient.getQueryState<PairUniverse>(PAIR_UNIVERSE_KEY),
    () => undefined,
  );
}

function SearchDialog({
  open,
  onOpenChange,
  trigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.RefObject<HTMLButtonElement | null>;
}) {
  const { open: openToken } = useTokenDrawerActions();
  const id = useId();
  const [query, setQuery] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  // Where focus was when the palette opened; it goes back there on Esc.
  const returnTo = useRef<Element | null>(null);
  // A chosen result waits here until the palette has closed, so the drawer
  // opens after the palette releases focus — never two modals at once.
  const chosen = useRef<SearchEntry | null>(null);

  const state = useCachedUniverseState(open);
  const status = resolveRadarStatus({
    data: state?.data,
    isPending: !state || state.status === "pending",
    isError: state?.status === "error",
    fetchStatus: state?.fetchStatus ?? "idle",
    failureCount: state?.fetchFailureCount ?? 0,
  });
  // `radarHistory` is written in the same poll that replaces the universe.
  const index = useMemo(
    () => (open ? buildSearchIndex(state?.data, radarHistory, status) : []),
    [open, state?.data, status],
  );
  // Results derive synchronously from the SAME query the input shows — no
  // deferred copy — so the list, the active option and Enter always agree.
  const outcome = useMemo(() => searchIndex(index, query), [index, query]);
  const { results } = outcome;
  const active = activeIndex(results, activeKey);
  const optionId = (i: number) => `${id}-option-${i}`;

  useEffect(() => {
    if (active < 0) return;
    document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [id, active, results]);

  const choose = (entry: SearchEntry) => {
    chosen.current = entry;
    onOpenChange(false);
  };
  const move = (delta: number) => {
    if (results.length === 0) return;
    const next = (active + delta + results.length) % results.length;
    setActiveKey(results[next].entry.key);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      move(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Re-derive from the input's live text at the moment of the keypress, so
      // Enter can never act on a list rendered for an earlier query.
      const live = searchIndex(index, e.currentTarget.value).results;
      const i = activeIndex(live, activeKey);
      if (i >= 0) choose(live[i].entry);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="mv-motion fixed inset-0 z-[var(--z-modal)] bg-(--void)/70 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-(--dur-micro) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-(--dur-micro)" />
        <DialogPrimitive.Content
          data-testid="global-search"
          onOpenAutoFocus={() => {
            returnTo.current = document.activeElement;
            setQuery("");
            setActiveKey(null);
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            const entry = chosen.current;
            chosen.current = null;
            if (entry) {
              // The drawer takes focus, and returns it to the SEARCH control on close.
              openToken(entry.ref, trigger.current);
              return;
            }
            const back = returnTo.current;
            const target =
              back instanceof HTMLElement && back.isConnected && back !== document.body
                ? back
                : trigger.current;
            target?.focus();
          }}
          // Command palette: a short fade + 4 px drop (micro). Elevated smoked glass
          // (a light backdrop blur on the palette only; the scrim stays a plain dim). The input
          // is focused at mount, so typing is never delayed by the animation.
          className="mv-motion fixed inset-x-0 top-0 z-[var(--z-modal)] flex max-h-[85dvh] flex-col mv-glass-elevated border-b border-(--hairline-strong) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1 data-[state=open]:duration-(--dur-micro) data-[state=open]:ease-(--ease-snap) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-(--dur-micro) sm:inset-x-auto sm:left-1/2 sm:top-[12vh] sm:max-h-[70vh] sm:w-[min(640px,calc(100vw-32px))] sm:-translate-x-1/2 sm:rounded-(--radius-md) sm:border"
        >
          <DialogPrimitive.Title className="sr-only">Global search</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search tokens MARCOVAULT currently holds by symbol, name, contract address, chain or
            source. Choosing a result opens its Token Intelligence Drawer.
          </DialogPrimitive.Description>
          <div className="hairline-b flex items-center gap-3 px-4">
            <Search className="size-4 shrink-0 text-(--faint)" aria-hidden />
            <input
              role="combobox"
              aria-label="Search the MARCOVAULT universe"
              aria-expanded={results.length > 0}
              aria-controls={`${id}-listbox`}
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? optionId(active) : undefined}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveKey(null);
              }}
              onKeyDown={onKeyDown}
              placeholder="Symbol, name, contract, chain or source"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="h-12 w-full min-w-0 bg-transparent font-mono text-[13px] text-(--bone) outline-none placeholder:text-(--faint)"
            />
            <DialogPrimitive.Close className="mv-glass mono-label shrink-0 px-1.5 py-1 text-[9px]!">
              ESC
              <span className="sr-only"> — close search</span>
            </DialogPrimitive.Close>
          </div>
          <ul
            id={`${id}-listbox`}
            role="listbox"
            aria-label="Search results"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 empty:hidden"
          >
            {results.map((r, i) => (
              <ResultRow
                key={r.entry.key}
                id={optionId(i)}
                result={r}
                active={i === active}
                showMatch={query.trim() !== ""}
                duplicate={outcome.duplicateSymbols.has(r.entry.symbol?.toLowerCase() ?? "")}
                onHover={() => setActiveKey(r.entry.key)}
                onSelect={() => choose(r.entry)}
              />
            ))}
          </ul>
          {outcome.unknownAddress ? (
            <Empty
              title="NOT IN CURRENT MARCOVAULT UNIVERSE"
              detail="MARCOVAULT has not observed this address in its current pair universe or retained history. It is not looked up elsewhere."
              code={outcome.unknownAddress}
            />
          ) : results.length === 0 && index.length === 0 ? (
            <Empty
              title="UNIVERSE NOT LOADED"
              detail="Search covers only tokens MARCOVAULT has already observed. The pair universe has no data yet."
            />
          ) : results.length === 0 ? (
            <Empty
              title="NO MATCH IN CURRENT MARCOVAULT UNIVERSE"
              detail="Try a symbol, part of a name, a contract address, a chain (solana, base, ethereum, bsc) or a source (boost, ads, realtime, radar)."
            />
          ) : null}
          <div className="hairline-t flex items-center justify-between gap-3 px-4 py-2 font-mono text-[9px] tracking-[0.18em] text-(--faint) uppercase">
            <span aria-live="polite">
              {results.length < outcome.total
                ? `${results.length} OF ${outcome.total}`
                : `${outcome.total} RESULT${outcome.total === 1 ? "" : "S"}`}{" "}
              · {index.length} INDEXED ·{" "}
              <span
                data-testid="search-status"
                className={
                  status === "live" ? "text-(--gold)" : status === "offline" ? "text-(--down)" : ""
                }
              >
                {status === "loading" ? "LOADING" : `UNIVERSE ${status.toUpperCase()}`}
              </span>
            </span>
            <span className="hidden sm:inline">↑↓ SELECT · ↵ OPEN · ESC CLOSE</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const SIGNAL_TONE: Record<RadarSignal, string> = {
  "EARLY MOMENTUM": "text-(--gold)",
  "LIQ REMOVED": "text-(--down)",
  "LIQ ADDED": "text-(--up)",
};

function ResultRow({
  id,
  result,
  active,
  showMatch,
  duplicate,
  onHover,
  onSelect,
}: {
  id: string;
  result: SearchResult;
  active: boolean;
  /** Which field matched — meaningless while browsing with an empty query. */
  showMatch: boolean;
  duplicate: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  const e = result.entry;
  const s = e.snapshot;
  const change = s?.priceChange.h24 ?? null;
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      data-key={e.key}
      onMouseMove={active ? undefined : onHover}
      onClick={onSelect}
      className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-sm border border-transparent px-3 py-2 aria-selected:border-(--hairline-strong) aria-selected:bg-(--panel-2) aria-selected:shadow-[inset_2px_0_0_var(--gold)]"
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="mv-chip shrink-0 text-(--gold)">
            {normalizeChain(e.chainId).toUpperCase()}
          </span>
          <span className="shrink-0 font-mono text-[12px] font-semibold text-(--bone)">
            {e.symbol ?? shortAddress(e.address)}
          </span>
          {e.name && <span className="truncate text-[11px] text-muted-foreground">{e.name}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] text-(--faint)">
          {e.symbol != null && (
            <span className={duplicate ? "text-(--champagne)" : undefined} title={e.address}>
              {shortAddress(e.address)}
            </span>
          )}
          <TemporalLabel entry={e} />
          {e.signal && <span className={SIGNAL_TONE[e.signal]}>{e.signal}</span>}
          {e.lastSignal && (
            // A signal carried by the stale fallback round: shown as history,
            // untinted, never as a signal of the current round.
            <span data-testid="last-signal">LAST SIGNAL {e.lastSignal}</span>
          )}
          {showMatch && <span className="hidden sm:inline">{TIER_LABEL[result.tier]}</span>}
        </div>
      </div>
      {s && (
        <div className="shrink-0 text-right font-mono text-[10px]">
          <div className="text-muted-foreground">
            LIQ {s.liquidityUsd == null ? "—" : formatNumber(s.liquidityUsd)}
          </div>
          {change != null && (
            <div className={`mt-1 ${change >= 0 ? "text-(--up)" : "text-(--down)"}`}>
              {change >= 0 ? "+" : ""}
              {change.toFixed(1)}% 24h
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/** The row's temporal truth — the same states the Token Drawer reports. */
function TemporalLabel({ entry }: { entry: SearchEntry }) {
  const [text, tone] =
    entry.state === "current"
      ? entry.round === "degraded"
        ? ["DEGRADED", "text-(--champagne)"]
        : [null, ""]
      : entry.state === "stale"
        ? ["STALE", "text-(--champagne)"]
        : entry.state === "retained"
          ? ["NOT IN CURRENT UNIVERSE", ""]
          : ["ID ONLY", ""];
  if (!text) return null;
  return (
    <span data-testid="temporal" className={tone}>
      {text}
    </span>
  );
}

function Empty({ title, detail, code }: { title: string; detail: string; code?: string }) {
  return (
    <div className="px-3 py-6 text-center" role="status">
      <div className="font-mono text-[10px] tracking-[0.2em] text-(--bone)">{title}</div>
      {code && <div className="mt-2 break-all font-mono text-[11px] text-(--faint)">{code}</div>}
      <p className="mx-auto mt-2 max-w-sm text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}
