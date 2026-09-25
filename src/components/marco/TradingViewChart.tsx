import { useEffect, useRef, useState } from "react";

type Status = "loading" | "ready" | "error";

/** How long to wait for TradingView's iframe before reporting a failure. */
const LOAD_TIMEOUT_MS = 20_000;

const EMBED_SRC = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

/**
 * TradingView Advanced Chart — real market data from TradingView, skinned to
 * the MONOLITH panel surface (`--panel` canvas, `--hairline` grid).
 *
 * TradingView's loader reads its config from the *text content* of the
 * `<script>` tag and renders an iframe into the sibling
 * `.tradingview-widget-container__widget` element, so each chart injects its
 * own script element; nothing about the chart is synthesized locally.
 */
export function TradingViewChart({
  symbol,
  className = "",
}: {
  symbol: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    setStatus("loading");
    const fail = () => !cancelled && setStatus("error");
    const ready = () => !cancelled && setStatus("ready");

    // The loader swaps the container's children for an iframe; wait for it,
    // then for that iframe's load event.
    const observer = new MutationObserver(() => {
      const iframe = container.querySelector("iframe");
      if (!iframe) return;
      observer.disconnect();
      iframe.addEventListener("load", ready, { once: true });
      iframe.addEventListener("error", fail, { once: true });
    });
    observer.observe(container, { childList: true });
    const timeout = window.setTimeout(fail, LOAD_TIMEOUT_MS);

    const script = document.createElement("script");
    script.src = EMBED_SRC;
    script.type = "text/javascript";
    script.async = true;
    script.onerror = fail;
    script.textContent = JSON.stringify({
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
    container.appendChild(script);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.clearTimeout(timeout);
      container.replaceChildren();
    };
  }, [symbol]);

  return (
    <div className={`tradingview-widget-container relative ${className}`} data-status={status}>
      <div
        ref={containerRef}
        className={`tradingview-widget-container__widget h-full w-full transition-opacity duration-500 ${
          status === "ready" ? "opacity-100" : "opacity-0"
        }`}
      />

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
