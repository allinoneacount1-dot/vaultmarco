import {
  COOLDOWN_BASE_MS,
  COOLDOWN_MAX_MS,
  ENDPOINTS,
  ENDPOINT_CAP_PER_ROUND,
  RETRY_BUDGET_PER_ROUND,
  RETRY_DELAY_MAX_MS,
  RETRY_DELAY_MIN_MS,
  type Endpoint,
} from "./constants";
import type { Cooldown, RequestAccounting } from "./model";
import { ProviderError } from "@/lib/providers/envelope";

/**
 * REQUEST PLANNER / LEDGER — per-endpoint accounting and limits for one round.
 *
 *   • hard per-endpoint cap per round (ENDPOINT_CAP_PER_ROUND)
 *   • 429: never retried in the same round; Retry-After honoured when present,
 *     otherwise a bounded exponential cooldown (≤ COOLDOWN_MAX_MS); the endpoint
 *     is skipped while cooling down
 *   • other transient failures: one retry per request, from a shared
 *     RETRY_BUDGET_PER_ROUND
 *   • every refusal surfaces as a ProviderError, so the engine reports the
 *     round degraded/offline — nothing is ever substituted
 */

export type RawResponse = { status: number; retryAfter: string | null; body: unknown };
/** The runtime adapter's HTTP primitive (no retries, no interpretation). */
export type RawHttp = (url: string) => Promise<RawResponse>;

export function emptyAccounting(): RequestAccounting {
  return Object.fromEntries(
    ENDPOINTS.map((e) => [e, { attempts: 0, ok: 0, failed: 0, rateLimited: 0, skipped: 0 }]),
  ) as RequestAccounting;
}

/** Retry-After: delta-seconds or an HTTP-date. Returns ms from `now`, or null. */
export function parseRetryAfter(value: string | null, now: number): number | null {
  if (value == null || value.trim() === "") return null;
  const v = value.trim();
  if (/^\d+$/.test(v)) return Number(v) * 1000;
  const at = Date.parse(v);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}

/** Cooldown after the n-th consecutive 429 (n ≥ 1). Retry-After, when given, is honoured as-is. */
export function nextCooldownMs(consecutive429: number, retryAfterMs: number | null): number {
  if (retryAfterMs != null) return retryAfterMs;
  const exp = COOLDOWN_BASE_MS * 2 ** Math.max(0, consecutive429 - 1);
  return Math.min(exp, COOLDOWN_MAX_MS);
}

/** Classify a DexScreener URL; token lookups are attributed by the current phase. */
export function endpointOf(url: string, tokenPhase: "ENRICHMENT" | "DUE"): Endpoint {
  if (url.includes("/token-boosts/latest/")) return "BOOST_LATEST";
  if (url.includes("/token-boosts/top/")) return "BOOST_TOP";
  if (url.includes("/ads/")) return "ADS";
  if (url.includes("/tokens/v1/"))
    return tokenPhase === "DUE" ? "DUE_TOKEN_BATCH" : "TOKEN_ENRICHMENT";
  if (url.includes("/latest/dex/pairs/")) {
    // A multi-pair fallback lists comma-separated addresses; canonical reads are single.
    return tokenPhase === "DUE" ? "PAIR_FALLBACK" : "CANONICAL_PAIR";
  }
  throw new Error(`unplanned endpoint: ${url}`);
}

export class RequestLedger {
  readonly accounting: RequestAccounting = emptyAccounting();
  private retriesLeft = RETRY_BUDGET_PER_ROUND;
  private readonly cooldowns = new Map<Endpoint, Cooldown>();
  private readonly touched = new Set<Endpoint>();
  phase: "ENRICHMENT" | "DUE" = "ENRICHMENT";

  constructor(
    private readonly http: RawHttp,
    private readonly now: () => number,
    cooldowns: readonly Cooldown[] = [],
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
    private readonly jitter: () => number = () => 0.5,
  ) {
    for (const c of cooldowns) this.cooldowns.set(c.endpoint, c);
  }

  /** Cooldowns to persist (only endpoints whose state changed this round). */
  cooldownUpdates(): Cooldown[] {
    return [...this.touched].map((e) => this.cooldowns.get(e)!).filter(Boolean);
  }

  totalAttempts(): number {
    return ENDPOINTS.reduce((n, e) => n + this.accounting[e].attempts, 0);
  }

  /** The engine-compatible `fetchJson(source, url)` backed by this ledger. */
  fetchJson = async (source: string, url: string): Promise<unknown> => {
    const endpoint = endpointOf(url, this.phase);
    const acc = this.accounting[endpoint];
    const cd = this.cooldowns.get(endpoint);
    if (cd && cd.until > this.now()) {
      acc.skipped++;
      throw new ProviderError(source, "RATE_LIMITED", `${endpoint} cooling down`);
    }
    // The cap counts requests (a transient retry of the same request is not a new one).
    if (acc.ok + acc.failed + acc.rateLimited >= ENDPOINT_CAP_PER_ROUND[endpoint]) {
      acc.skipped++;
      throw new ProviderError(source, "RATE_LIMITED", `${endpoint} round cap reached`);
    }

    for (let attempt = 0; ; attempt++) {
      acc.attempts++;
      let res: RawResponse;
      try {
        res = await this.http(url);
      } catch (err) {
        if (attempt === 0 && this.retriesLeft > 0) {
          this.retriesLeft--;
          await this.sleep(this.retryDelay());
          continue;
        }
        acc.failed++;
        throw new ProviderError(
          source,
          "NETWORK_ERROR",
          err instanceof Error ? err.message : String(err),
        );
      }
      if (res.status === 429) {
        acc.rateLimited++;
        const prev = this.cooldowns.get(endpoint);
        const n = (prev?.consecutive429 ?? 0) + 1;
        const ms = nextCooldownMs(n, parseRetryAfter(res.retryAfter, this.now()));
        this.cooldowns.set(endpoint, { endpoint, until: this.now() + ms, consecutive429: n });
        this.touched.add(endpoint);
        throw new ProviderError(source, "RATE_LIMITED", `${url} returned 429`);
      }
      if (res.status >= 500 && attempt === 0 && this.retriesLeft > 0) {
        this.retriesLeft--;
        await this.sleep(this.retryDelay());
        continue;
      }
      if (res.status < 200 || res.status >= 300) {
        acc.failed++;
        throw new ProviderError(source, "HTTP_ERROR", `${url} returned ${res.status}`);
      }
      acc.ok++;
      if (this.cooldowns.get(endpoint)?.consecutive429) {
        this.cooldowns.set(endpoint, { endpoint, until: 0, consecutive429: 0 });
        this.touched.add(endpoint);
      }
      return res.body;
    }
  };

  private retryDelay(): number {
    return RETRY_DELAY_MIN_MS + (RETRY_DELAY_MAX_MS - RETRY_DELAY_MIN_MS) * this.jitter();
  }
}
