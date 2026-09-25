import { useEffect, useRef, useState } from "react";

type Status = "loading" | "ready" | "error";

/** How long to wait for TradingView's iframe before reporting a failure. */
const LOAD_TIMEOUT_MS = 20_000;

const EMBED_SRC = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

/**
 * TradingView Advanced Chart — real market data from TradingView, skinned to
 * the MONOLITH panel surface (`--panel` canvas, `--hairline` grid).
 *
 * Follows TradingView's official React embed structure: the ref sits on the
 * outer `.tradingview-widget-container`, the embed script (with its JSON
 * config as text content) is appended to that outer element, and TradingView's
 * loader renders its iframe into the inner `.tradingview-widget-container__widget`.
 * Nothing about the chart is synthesized locally.
 */
export function TradingViewChart({
  symbol,
  className = "",
}: {
  symbol: string;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const outer = container.current;
    if (!outer) return;
    const widget = outer.querySelector<HTMLDivElement>(".tradingview-widget-container__widget");
    if (!widget) return;

    let cancelled = false;
    setStatus("loading");
    const fail = () => {
      if (!cancelled) setStatus("error");
    };
    const ready = () => {
      if (!cancelled) setStatus("ready");
    };

    // TradingView's loader inserts its iframe inside the outer container (into
    // the inner widget div); watch the whole subtree so we catch it wherever it
    // lands, then wait for that iframe's load event.
    const observer = new MutationObserver(() => {
      const iframe = outer.querySelector("iframe");
      if (!iframe) return;
      observer.disconnect();
      iframe.addEventListener("load", ready, { once: true });
      iframe.addEventListener("error", fail, { once: true });
    });
    observer.observe(outer, { childList: true, subtree: true });
    const timeout = window.setTimeout(fail, LOAD_TIMEOUT_MS);

    const script = document.createElement("script");
    script.src = EMBED_SRC;
    script.type = "text/javascript";
    script.async = true;
    script.onerror = fail;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: "60",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "#101114", // --panel
      gridColor: "rgba(232, 230, 225, 0.08)", // --hairline
      allow_symbol_change: false,
      hide_side_toolbar: true,
      withdateranges: true,
      details: false,
      calendar: false,
      save_image: false,
      support_host: "https://www.tradingview.com",
    });
    outer.appendChild(script);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.clearTimeout(timeout);
      // Drop everything TradingView created plus our script so a remount
      // (symbol change, StrictMode) starts from a clean container.
      script.remove();
      widget.replaceChildren();
      outer.querySelectorAll("iframe").forEach((el) => el.remove());
    };
  }, [symbol]);

  return (
    <div className={`relative ${className}`} data-status={status}>
      <div
        ref={container}
        className={`tradingview-widget-container h-full w-full transition-opacity duration-500 ${
          status === "ready" ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="tradingview-widget-container__widget h-full w-full" />
      </div>

      {status === "loading" && (
        <div role="status" aria-label="Loading chart" className="absolute inset-0 p-3">
          <div className="h-4 w-24 bg-(--panel-2) rounded animate-pulse mb-2" />
          <div className="h-3 w-48 bg-(--panel-2) rounded animate-pulse" />
        </div>
      )}

      {status === "error" && (
        <div role="alert" className="absolute inset-0 flex items-center justify-center p-3">
          <div className="text-[11px] text-muted-foreground text-center">
            Chart unavailable — TradingView could not be reached.{" "}
            <a
              href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-(--gold) hover:text-(--bone) transition-colors"
            >
              Open on TradingView
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
