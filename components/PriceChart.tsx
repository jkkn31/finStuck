// Big interactive price chart (TradingView's lightweight-charts) with:
// - SMA 50 / SMA 200 toggles
// - Range selector: 1D, 1W, 1M, 3M, YTD, 1Y, 5Y
//   * 1M..5Y slice the existing 5Y daily history client-side (instant)
//   * 1D and 1W fetch intraday bars from /api/history/:ticker on demand

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { sma } from "@/lib/tools/indicators";

export type ChartPoint = { date: string; close: number; volume?: number };

export type Range = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "5Y";
const RANGES: Range[] = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y"];

// Parent components (DetailedStockCard / DetailHero) subscribe to this to render
// a period-relative change % in their header. We emit the start price (not the
// pct) so the parent can combine with live prices for an up-to-the-tick number.
export type RangeStartInfo = { range: Range; startPrice: number } | null;

export default function PriceChart({
  ticker,
  data,
  onRangeStartChange,
}: {
  ticker: string;
  data: ChartPoint[];
  onRangeStartChange?: (info: RangeStartInfo) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<Range>("5Y");
  const [show50, setShow50] = useState(true);
  const [show200, setShow200] = useState(true);
  // Cache of intraday bars keyed by range.
  const [intraday, setIntraday] = useState<Partial<Record<Range, ChartPoint[]>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch intraday on demand for 1D / 1W.
  useEffect(() => {
    if (range !== "1D" && range !== "1W") return;
    if (intraday[range]) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/history/${encodeURIComponent(ticker)}?range=${range.toLowerCase()}`)
      .then(async (res) => {
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "fetch failed");
        return j.data as ChartPoint[];
      })
      .then((bars) => {
        if (cancelled) return;
        setIntraday((prev) => ({ ...prev, [range]: bars }));
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, ticker, intraday]);

  // The data to actually plot for the current range.
  const displayData: ChartPoint[] = useMemo(() => {
    if (range === "1D" || range === "1W") return intraday[range] ?? [];
    if (range === "YTD") {
      const year = new Date().getFullYear();
      return data.filter((d) => d.date.startsWith(`${year}-`));
    }
    const days: Record<Exclude<Range, "1D" | "1W" | "YTD">, number> = {
      "1M": 22,
      "3M": 66,
      "1Y": 252,
      "5Y": 1260,
    };
    return data.slice(-days[range]);
  }, [range, data, intraday]);

  // SMAs are only drawn on daily-range views. Intraday views don't have enough
  // history on their own to compute a meaningful 50/200-day SMA.
  const showSmas = range !== "1D" && range !== "1W";

  // Broadcast the current range's starting price to the parent so it can
  // compute a period-relative change %. Fires on every range / data change.
  useEffect(() => {
    if (!onRangeStartChange) return;
    if (displayData.length === 0) {
      onRangeStartChange(null);
    } else {
      onRangeStartChange({ range, startPrice: displayData[0].close });
    }
  }, [range, displayData, onRangeStartChange]);

  useEffect(() => {
    if (!ref.current || displayData.length === 0) return;

    // US-market-native timezone. America/New_York auto-handles EDT/EST transitions.
    const ET = "America/New_York";
    const fmtTick = (unixSec: number, tickMarkType: number, locale: string) => {
      const d = new Date(unixSec * 1000);
      const base: Intl.DateTimeFormatOptions = { timeZone: ET };
      switch (tickMarkType) {
        case 0: // Year
          return new Intl.DateTimeFormat(locale, { ...base, year: "numeric" }).format(d);
        case 1: // Month
          return new Intl.DateTimeFormat(locale, { ...base, month: "short", year: "2-digit" }).format(d);
        case 2: // Day of month
          return new Intl.DateTimeFormat(locale, { ...base, day: "numeric", month: "short" }).format(d);
        default: // Time / TimeWithSeconds
          return new Intl.DateTimeFormat(locale, {
            ...base,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(d);
      }
    };
    const fmtTooltip = (unixSec: number) =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: ET,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(unixSec * 1000)) + " ET";

    const chart: IChartApi = createChart(ref.current, {
      height: 380,
      layout: { background: { color: "transparent" }, textColor: "#71717a" },
      grid: {
        vertLines: { color: "rgba(161,161,170,0.15)" },
        horzLines: { color: "rgba(161,161,170,0.15)" },
      },
      rightPriceScale: { borderColor: "rgba(161,161,170,0.3)" },
      timeScale: {
        borderColor: "rgba(161,161,170,0.3)",
        timeVisible: !showSmas,
        secondsVisible: false,
        tickMarkFormatter: (time: unknown, tickMarkType: unknown, locale: string) =>
          fmtTick(time as number, tickMarkType as number, locale),
      },
      localization: {
        timeFormatter: (timePoint: unknown) => {
          const sec =
            typeof timePoint === "number"
              ? timePoint
              : (timePoint as { timestamp?: number })?.timestamp ?? 0;
          return typeof sec === "number" && sec > 0 ? fmtTooltip(sec) : "";
        },
      },
    });

    const price: ISeriesApi<"Line"> = chart.addSeries(LineSeries, {
      color: "#10b981",
      lineWidth: 2,
    });
    price.setData(
      displayData.map((d) => ({
        time: Math.floor(new Date(d.date).getTime() / 1000) as UTCTimestamp,
        value: d.close,
      })),
    );

    if (showSmas) {
      // Compute SMAs over the FULL 5Y daily series (`data`), not just the
      // visible slice. A 1M view only has ~22 bars — not enough to seed a
      // 50-period SMA, let alone 200. By anchoring to the full history and
      // then filtering to the visible date range, short-range views still
      // show the tail end of continuous SMA curves (matching how every
      // trading platform renders it).
      const fullCloses = data.map((d) => d.close);
      const fullS50 = show50 ? sma(fullCloses, 50) : null;
      const fullS200 = show200 ? sma(fullCloses, 200) : null;

      // Visible range as a set of ISO dates for O(1) filtering.
      const visibleDates = new Set(displayData.map((d) => d.date));

      const sliceToVisible = (series: (number | null)[]) =>
        data
          .map((d, i) => {
            if (!visibleDates.has(d.date)) return null;
            const v = series[i];
            if (v == null) return null;
            return {
              time: Math.floor(new Date(d.date).getTime() / 1000) as UTCTimestamp,
              value: v,
            };
          })
          .filter((x): x is { time: UTCTimestamp; value: number } => x != null);

      if (show50 && fullS50) {
        const series = chart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 1 });
        series.setData(sliceToVisible(fullS50));
      }
      if (show200 && fullS200) {
        const series = chart.addSeries(LineSeries, { color: "#f97316", lineWidth: 1 });
        series.setData(sliceToVisible(fullS200));
      }
    }

    // Volume pane. Rendered as a histogram on a dedicated invisible price
    // scale, squeezed into the bottom ~25% of the chart. Bar color follows
    // the day's direction (green on an up close, red on a down close) so
    // volume tells the same story as price direction at a glance.
    //
    // Skipped entirely when the displayed series has no volume data — can
    // happen for older cached StockAnalysis entries written before the
    // schema added `volume`, or if Yahoo omitted volume on a given ticker.
    const hasVolume = displayData.some((d) => d.volume != null && d.volume > 0);
    if (hasVolume) {
      // Volume on the LEFT price scale so the numeric axis is visible to the
      // user (e.g. "12.3M", "456K"). Keeping it off the right scale also
      // means price and volume never share axis scaling — volume in the
      // millions would otherwise flatten the price line.
      const volume: ISeriesApi<"Histogram"> = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "left",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      volume.setData(
        displayData.map((d, i) => {
          const prev = i > 0 ? displayData[i - 1].close : d.close;
          const up = d.close >= prev;
          return {
            time: Math.floor(new Date(d.date).getTime() / 1000) as UTCTimestamp,
            value: d.volume ?? 0,
            // Semi-transparent so the price line remains readable if volume
            // bars overlap the price's vertical range.
            color: up ? "rgba(16,185,129,0.45)" : "rgba(244,63,94,0.45)",
          };
        }),
      );
      // Pin the volume scale to the bottom 22% of the chart area with axis
      // labels visible on the left edge. Lightweight-charts auto-picks
      // round tick values like "20M", "40M", and scaleMargins clip them
      // so the numbers only appear in the volume band.
      chart.priceScale("left").applyOptions({
        scaleMargins: { top: 0.78, bottom: 0 },
        visible: true,
        borderColor: "rgba(161,161,170,0.3)",
      });
      // Shrink the main right-scale so the price series + SMAs render in
      // the top 72% and don't overlap the volume bars.
      chart.priceScale("right").applyOptions({
        scaleMargins: { top: 0.05, bottom: 0.28 },
      });
    }

    chart.timeScale().fitContent();

    const onResize = () => chart.applyOptions({ width: ref.current!.clientWidth });
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
    };
  }, [displayData, data, show50, show200, showSmas]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
        {showSmas && (
          <>
            <Toggle active={show50} onChange={setShow50} label="SMA 50" color="bg-blue-500" />
            <Toggle active={show200} onChange={setShow200} label="SMA 200" color="bg-orange-500" />
          </>
        )}
        <div className="ml-auto flex items-center gap-3">
          {loading && <span className="text-zinc-400">Loading…</span>}
          {error && <span className="text-rose-600">{error}</span>}
          <div className="flex gap-0.5">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={
                  r === range
                    ? "px-2 py-0.5 rounded bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900 text-[11px] font-mono"
                    : "px-2 py-0.5 rounded text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-mono"
                }
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div ref={ref} className="w-full" style={{ minHeight: 380 }} />
    </div>
  );
}

function Toggle({
  active,
  onChange,
  label,
  color,
}: {
  active: boolean;
  onChange: (v: boolean) => void;
  label: string;
  color: string;
}) {
  return (
    <button
      onClick={() => onChange(!active)}
      className={`flex items-center gap-1.5 px-2 py-1 rounded border ${
        active ? "border-zinc-400 dark:border-zinc-600" : "border-zinc-200 dark:border-zinc-800 opacity-50"
      }`}
    >
      <span className={`inline-block w-3 h-0.5 ${color}`} />
      {label}
    </button>
  );
}
