import { ProviderError } from "./envelope";

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Fetch JSON from a provider, converting every failure mode into a typed
 * `ProviderError`. Nothing here ever returns a substitute payload — callers
 * are forced to handle the failure explicitly.
 */
export async function fetchJson(
  source: string,
  url: string,
  opts: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<unknown> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      throw new ProviderError(
        source,
        "TIMEOUT",
        `request to ${url} timed out after ${timeoutMs}ms`,
      );
    }
    throw new ProviderError(
      source,
      "NETWORK_ERROR",
      err instanceof Error ? err.message : `network failure for ${url}`,
    );
  }
  clearTimeout(timer);

  if (res.status === 429) {
    throw new ProviderError(source, "RATE_LIMITED", `${url} returned 429`);
  }
  if (!res.ok) {
    throw new ProviderError(source, "HTTP_ERROR", `${url} returned ${res.status}`);
  }

  try {
    return await res.json();
  } catch {
    throw new ProviderError(source, "INVALID_JSON", `${url} did not return parseable JSON`);
  }
}
