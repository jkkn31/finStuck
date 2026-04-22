// Client wrapper for the detail page's hero section (header + chart + signal
// bar + stats). Encapsulates the PriceChart's selected range so the header
// percentage reflects the currently-displayed time frame. Pure presentation —
// takes analysis + chart snapshot as props; no data fetching.

"use client";

import { useCallback, useState } from "react";
import type { StockAnalysis } from "@/lib/schemas";
import PriceChart, { type RangeStartInfo } from "./PriceChart";
import SignalBadge from "./SignalBadge";
import SignalBar from "./SignalBar";
import GlossaryLabel, { type GlossaryTerm } from "./GlossaryLabel";

type TechnicalSnap = {
  hi52w: number;
  lo52w: number;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  trend: "up" | "down" | "sideways";
};

type Props = {
  analysis: StockAnalysis;
  chart: { history: Array<{ date: string; close: number }>; snap: TechnicalSnap };
};

export default function DetailHero({ analysis, chart }: Props) {
  const [rangeStart, setRangeStart] = useState<RangeStartInfo>(null);
  const onRangeStartChange = useCallback((info: RangeStartInfo) => setRangeStart(info), []);

  const currentPrice = analysis.price;
  const { displayChangePct, periodLabel } = rangeStart
    ? {
        displayChangePct:
          ((currentPrice - rangeStart.startPrice) / rangeStart.startPrice) * 100,
        periodLabel: rangeStart.range,
      }
    : { displayChangePct: analysis.changePercent, periodLabel: null };
  const up = displayChangePct >= 0;

  return (
    <>
      <section className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm text-zinc-500">{analysis.name}</div>
          <h1 className="text-3xl font-semibold">{analysis.ticker}</h1>
          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            <div className="text-2xl font-semibold">${currentPrice.toFixed(2)}</div>
            <div className={up ? "text-emerald-600" : "text-rose-600"}>
              {up ? "▲" : "▼"} {displayChangePct.toFixed(2)}%
              {periodLabel && (
                <span className="ml-1 text-xs font-mono text-zinc-500">· {periodLabel}</span>
              )}
            </div>
          </div>
        </div>
        <SignalBadge signal={analysis.signal.signal} confidence={analysis.signal.confidence} />
      </section>

      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <PriceChart
          ticker={analysis.ticker}
          data={chart.history.map((h) => ({ date: h.date, close: h.close }))}
          onRangeStartChange={onRangeStartChange}
        />
        <SignalBar signal={analysis.signal} />
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Stat term="52W_HIGH" label="52w high" value={`$${chart.snap.hi52w.toFixed(2)}`} />
          <Stat term="52W_LOW" label="52w low" value={`$${chart.snap.lo52w.toFixed(2)}`} />
          <Stat term="SMA_50" label="SMA50" value={chart.snap.sma50 ? `$${chart.snap.sma50.toFixed(2)}` : "—"} />
          <Stat term="SMA_200" label="SMA200" value={chart.snap.sma200 ? `$${chart.snap.sma200.toFixed(2)}` : "—"} />
          <Stat term="RSI" label="RSI(14)" value={chart.snap.rsi14 != null ? chart.snap.rsi14.toFixed(1) : "—"} />
          <Stat term="TREND" label="Trend" value={chart.snap.trend} />
          <Stat term="PE" label="P/E" value={fmt(analysis.fundamentals.peRatio)} />
          <Stat term="FORWARD_PE" label="Forward P/E" value={fmt(analysis.fundamentals.forwardPE)} />
          <Stat term="PEG" label="PEG" value={fmt(analysis.fundamentals.pegRatio)} />
          <Stat term="EPS_TTM" label="EPS TTM" value={fmt(analysis.fundamentals.epsTtm)} />
          <Stat term="REVENUE_GROWTH" label="Revenue growth YoY" value={pct(analysis.fundamentals.revenueGrowthYoY)} />
          <Stat term="PROFIT_MARGIN" label="Profit margin" value={pct(analysis.fundamentals.profitMargin)} />
          <Stat term="DEBT_EQUITY" label="Debt / Equity" value={fmt(analysis.fundamentals.debtToEquity)} />
        </div>
      </section>
    </>
  );
}

function Stat({
  label,
  value,
  term,
}: {
  label: string;
  value: string;
  term?: GlossaryTerm;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-2">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">
        {term ? <GlossaryLabel term={term}>{label}</GlossaryLabel> : label}
      </div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return typeof n === "number" ? n.toFixed(2) : String(n);
}

function pct(n: number | null | undefined): string {
  if (n == null) return "—";
  // Same defensive handling as the detail page — LLM occasionally returns
  // values already in percent form instead of decimal form.
  const asPercent = Math.abs(n) > 1.5 ? n : n * 100;
  return `${asPercent.toFixed(1)}%`;
}
