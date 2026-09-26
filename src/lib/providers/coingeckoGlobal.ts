import { z } from "zod";
import { type DataEnvelope, ProviderError, liveEnvelope, toProviderErrorInfo } from "./envelope";
import { fetchJson } from "./http";

/**
 * GLOBAL MARKET — CoinGecko `/api/v3/global` and alternative.me `/fng`.
 *
 * Both are read by the ONE `["globalStats"]` query loop (see useGlobalStats);
 * this module only fetches, validates and wraps. Nothing here substitutes a
 * value: a field that is missing or fails validation is `null` ("—" in the UI),
 * and a response whose root is unusable is a thrown `ProviderError`.
 *
 * UNVERIFIED: the `/global` field paths below (`total_market_cap.usd`,
 * `total_volume.usd`, `market_cap_change_percentage_24h_usd`,
 * `market_cap_percentage.btc`, `updated_at`) are the ones the dashboard already
 * read before this module existed. No live `/global` response could be captured
 * from the development sandbox, so the shape must be checked once against the
 * production provider.
 */

export const COINGECKO_GLOBAL_SOURCE = "coingecko";
export const FEAR_GREED_SOURCE = "alternative.me";

const COINGECKO_GLOBAL_URL = "https://api.coingecko.com/api/v3/global";
const FEAR_GREED_URL = "https://api.alternative.me/fng/?limit=1";

export type Deps = { fetchJson: typeof fetchJson; now: () => number };
const defaultDeps: Deps = { fetchJson, now: () => Date.now() };

/** A finite number, or null. Never coerces strings, never defaults to 0. */
const finite = z.number().finite();
const finiteNonNeg = finite.nonnegative();

function pick(schema: z.ZodTypeAny, value: unknown): number | null {
  const r = schema.safeParse(value);
  return r.success ? (r.data as number) : null;
}

/** Root shape: `{ data: { … } }`. Anything else is a schema mismatch. */
const GlobalRootSchema = z.object({
  data: z.object({
    total_market_cap: z.record(z.unknown()).optional(),
    total_volume: z.record(z.unknown()).optional(),
    market_cap_percentage: z.record(z.unknown()).optional(),
    market_cap_change_percentage_24h_usd: z.unknown().optional(),
    updated_at: z.unknown().optional(),
  }),
});

export type GlobalMarket = {
  /** GLOBAL crypto market cap, USD (`total_market_cap.usd`). */
  totalMcapUsd: number | null;
  /** GLOBAL crypto 24h volume, USD (`total_volume.usd`). */
  totalVolumeUsd: number | null;
  /** 24h % change of the global market cap (`market_cap_change_percentage_24h_usd`). */
  mcapChange24hPct: number | null;
  /** BTC dominance, % (`market_cap_percentage.btc`). */
  btcDominancePct: number | null;
  /** Provider's own observation time (epoch ms from `updated_at` seconds), if valid. */
  providerUpdatedAt: number | null;
};

/** The four figures the desk reads; a missing one makes the response `degraded`. */
const EXPECTED: (keyof GlobalMarket)[] = [
  "totalMcapUsd",
  "totalVolumeUsd",
  "mcapChange24hPct",
  "btcDominancePct",
];

/** Validate a raw `/global` body. Throws SCHEMA_MISMATCH when the root is unusable. */
export function parseGlobal(raw: unknown): { data: GlobalMarket; missing: number } {
  const root = GlobalRootSchema.safeParse(raw);
  if (!root.success) {
    throw new ProviderError(
      COINGECKO_GLOBAL_SOURCE,
      "SCHEMA_MISMATCH",
      "expected `{ data: { … } }` from /global",
    );
  }
  const d = root.data.data;
  const updated = pick(finiteNonNeg, d.updated_at);
  const data: GlobalMarket = {
    totalMcapUsd: pick(finiteNonNeg, d.total_market_cap?.usd),
    totalVolumeUsd: pick(finiteNonNeg, d.total_volume?.usd),
    mcapChange24hPct: pick(finite, d.market_cap_change_percentage_24h_usd),
    btcDominancePct: pick(finiteNonNeg, d.market_cap_percentage?.btc),
    providerUpdatedAt: updated == null ? null : updated * 1000,
  };
  const missing = EXPECTED.filter((k) => data[k] == null).length;
  return { data, missing };
}

/** Read CoinGecko `/global`. `degraded` when any expected figure was unusable. */
export async function fetchGlobalMarket(
  deps: Deps = defaultDeps,
): Promise<DataEnvelope<GlobalMarket>> {
  const raw = await deps.fetchJson(COINGECKO_GLOBAL_SOURCE, COINGECKO_GLOBAL_URL);
  const { data, missing } = parseGlobal(raw);
  if (missing === EXPECTED.length) {
    throw new ProviderError(
      COINGECKO_GLOBAL_SOURCE,
      "SCHEMA_MISMATCH",
      "/global carried none of the expected figures",
    );
  }
  return liveEnvelope(COINGECKO_GLOBAL_SOURCE, data, deps.now(), missing);
}

export type FearGreed = { value: number | null; label: string | null };

const FngRootSchema = z.object({
  data: z.array(
    z.object({ value: z.unknown().optional(), value_classification: z.unknown().optional() }),
  ),
});

/** Read alternative.me Fear & Greed (latest value). */
export async function fetchFearGreed(deps: Deps = defaultDeps): Promise<DataEnvelope<FearGreed>> {
  const raw = await deps.fetchJson(FEAR_GREED_SOURCE, FEAR_GREED_URL);
  const root = FngRootSchema.safeParse(raw);
  if (!root.success) {
    throw new ProviderError(FEAR_GREED_SOURCE, "SCHEMA_MISMATCH", "expected `{ data: [ … ] }`");
  }
  const row = root.data.data[0];
  // The provider sends the index as a numeric string ("62").
  const n =
    typeof row?.value === "string" && /^\d+(\.\d+)?$/.test(row.value.trim())
      ? Number(row.value)
      : null;
  const label = typeof row?.value_classification === "string" ? row.value_classification : null;
  return liveEnvelope(FEAR_GREED_SOURCE, { value: n, label }, deps.now(), n == null ? 1 : 0);
}

/**
 * One provider's outcome for this round, carried across rounds:
 *   fulfilled → the fresh envelope (live / degraded);
 *   rejected  → the previous real payload marked `stale` (lastSuccessfulAt
 *               kept, fetchedAt null), or an `offline` envelope with no data.
 * A cached payload is never re-stamped as fresh.
 */
export function settleEnvelope<T>(
  source: string,
  result: PromiseSettledResult<DataEnvelope<T>>,
  previous: DataEnvelope<T> | null | undefined,
): DataEnvelope<T | null> {
  if (result.status === "fulfilled") return result.value;
  const error = toProviderErrorInfo(source, result.reason);
  if (previous && previous.lastSuccessfulAt != null && previous.data != null) {
    return { ...previous, status: "stale", fetchedAt: null, error };
  }
  return {
    data: null,
    status: "offline",
    source,
    fetchedAt: null,
    lastSuccessfulAt: null,
    error,
  };
}
