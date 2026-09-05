/**
 * Provider result envelope.
 *
 * Every upstream read in MARCOVAULT is wrapped in a `DataEnvelope` so the
 * application can always tell these four situations apart:
 *
 *   live     — this payload came from a successful provider response just now.
 *   stale    — the provider is currently failing; this payload is the last
 *              *real* successful response we received (never a hardcoded one).
 *   degraded — the provider answered, but part of the payload was unusable
 *              (e.g. some items failed schema validation and were dropped).
 *   offline  — the provider is failing and we have no prior real response.
 *
 * The rule this type exists to enforce: a provider failure must never be
 * silently reshaped into a plausible-looking success. `data` is only ever
 * populated from a real provider response.
 */
export type ProviderStatus = "live" | "stale" | "degraded" | "offline";

export type ProviderErrorCode =
  | "HTTP_ERROR"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "INVALID_JSON"
  | "SCHEMA_MISMATCH"
  | "RATE_LIMITED";

export type ProviderErrorInfo = {
  code: ProviderErrorCode;
  message: string;
};

export type DataEnvelope<T> = {
  data: T;
  status: ProviderStatus;
  /** Provider identifier, e.g. "coingecko" or "dexscreener". */
  source: string;
  /** Epoch ms when this payload was received, or null if it is not fresh. */
  fetchedAt: number | null;
  /** Epoch ms of the most recent successful provider response. */
  lastSuccessfulAt: number | null;
  error?: ProviderErrorInfo;
  /**
   * Number of items dropped because they failed per-item validation. A
   * non-zero value is what makes a response `degraded` rather than `live`.
   */
  droppedItems?: number;
};

/** A provider failure carrying a machine-readable reason. */
export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly source: string;

  constructor(source: string, code: ProviderErrorCode, message: string) {
    super(`[${source}] ${code}: ${message}`);
    this.name = "ProviderError";
    this.code = code;
    this.source = source;
  }

  toInfo(): ProviderErrorInfo {
    return { code: this.code, message: this.message };
  }
}

export function toProviderErrorInfo(source: string, err: unknown): ProviderErrorInfo {
  if (err instanceof ProviderError) return err.toInfo();
  if (err instanceof Error) return { code: "NETWORK_ERROR", message: `[${source}] ${err.message}` };
  return { code: "NETWORK_ERROR", message: `[${source}] unknown error` };
}

export function liveEnvelope<T>(
  source: string,
  data: T,
  at: number,
  droppedItems = 0,
): DataEnvelope<T> {
  return {
    data,
    status: droppedItems > 0 ? "degraded" : "live",
    source,
    fetchedAt: at,
    lastSuccessfulAt: at,
    ...(droppedItems > 0 ? { droppedItems } : {}),
  };
}

/**
 * Derive the envelope the UI should present, given the last successful
 * envelope held by the query cache and the current query state.
 *
 * This is the only place allowed to decide "stale" vs "offline", and it can
 * only ever hand back data that came from `previous` — a real prior response.
 */
export function resolveEnvelope<T>(args: {
  source: string;
  previous: DataEnvelope<T> | undefined;
  isError: boolean;
  error: unknown;
  /**
   * react-query pauses instead of erroring when it classifies a failure as an
   * offline condition (its default `networkMode: "online"`). A paused query
   * that has already failed is a provider failure and must not keep a "live"
   * label, so it is treated exactly like an error here.
   */
  fetchStatus?: "fetching" | "paused" | "idle";
  fetchFailureCount?: number;
  fetchFailureReason?: unknown;
}): DataEnvelope<T> | undefined {
  const { source, previous, isError } = args;
  const paused = args.fetchStatus === "paused" && (args.fetchFailureCount ?? 0) > 0;
  const failing = isError || paused;
  const error = isError ? args.error : (args.fetchFailureReason ?? args.error);

  if (!failing) return previous;

  const info = toProviderErrorInfo(source, error);

  if (!previous) {
    return {
      data: undefined as unknown as T,
      status: "offline",
      source,
      fetchedAt: null,
      lastSuccessfulAt: null,
      error: info,
    };
  }

  return {
    ...previous,
    status: "stale",
    fetchedAt: null,
    error: info,
  };
}
