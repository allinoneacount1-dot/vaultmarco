import type { RawHttp, RawResponse } from "@/lib/history/requests";

/**
 * The recorder's HTTP primitive over Web `fetch` (Deno, Node, Workers). No
 * retries and no interpretation — the RequestLedger owns budgets, retries and
 * 429 cooldowns. A timeout or network failure throws; a non-2xx status is
 * returned as-is; a 2xx body that is not JSON throws (never guessed).
 */
export function fetchRawHttp(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 8_000,
  headers: Record<string, string> = { accept: "application/json" },
): RawHttp {
  return async (url: string): Promise<RawResponse> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { headers, signal: ctrl.signal });
      const retryAfter = res.headers.get("retry-after");
      if (res.status < 200 || res.status >= 300) {
        await res.body?.cancel().catch(() => {});
        return { status: res.status, retryAfter, body: null };
      }
      const text = await res.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error(`invalid JSON from ${new URL(url).pathname}`);
      }
      return { status: res.status, retryAfter, body };
    } finally {
      clearTimeout(timer);
    }
  };
}
