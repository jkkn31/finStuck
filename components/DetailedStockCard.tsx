// Full stock analysis card. Shows everything inline — chart, stats, checklist,
// signal rationale, per-agent findings, forward plans, headlines. Used on the
// dashboard; no separate detail-page navigation needed.
//
// If a Finnhub WebSocket tick is present (`live` prop), the header price +
// change % update in real time; otherwise it falls back to the delayed Yahoo
// quote captured when the analysis ran.

"use client";

import { useCallback, useEffect, useState } from "react";
import type { StockAnalysis } from "@/lib/schemas";
import type { LivePrice, LiveStatus } from "@/hooks/useLivePrices";
import SignalBadge from "./SignalBadge";
import PriceChart, { type RangeStartInfo } from "./PriceChart";
import LivePricePill from "./LivePricePill";
import ChecklistSection from "./ChecklistSection";
import SignalBar from "./SignalBar";
import GlossaryLabel, { type GlossaryTerm } from "./GlossaryLabel";
import EducatorNudge from "./EducatorNudge";
import TimeMachineBacktest from "./TimeMachineBacktest";
import DecisionJournalForm from "./DecisionJournalForm";

type Props = {
  a: StockAnalysis;
  live?: LivePrice;
  liveStatus?: LiveStatus;
};

export default function DetailedStockCard({ a, live, liveStatus = "disabled" }: Props) {
  const t = a.technicals;

  // Live price (or delayed snapshot fallback).
  const displayPrice = live?.price ?? a.price;

  // Period-relative change tracks whatever range the PriceChart is currently
  // showing. Starts null → we fall back to the "today" change until the chart
  // mounts and emits its initial range.
  const [rangeStart, setRangeStart] = useState<RangeStartInfo>(null);
  const onRangeStartChange = useCallback((info: RangeStartInfo) => setRangeStart(info), []);

  const { displayChangePct, periodLabel } = rangeStart
    ? {
        displayChangePct:
          ((displayPrice - rangeStart.startPrice) / rangeStart.startPrice) * 100,
        periodLabel: rangeStart.range,
      }
    : {
        displayChangePct:
          live?.price != null && a.previousClose > 0
            ? ((live.price - a.previousClose) / a.previousClose) * 100
            : a.changePercent,
        periodLabel: null,
      };
  const up = displayChangePct >= 0;

  // Tick age — updates every second when a live price is present.
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [live]);
  const ageSec = live ? Math.max(0, Math.floor((nowMs - live.timestamp) / 1000)) : undefined;

  // Flash the price briefly on every tick.
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const [lastPrice, setLastPrice] = useState<number | undefined>(live?.price);
  useEffect(() => {
    if (live?.price == null) return;
    if (lastPrice != null && live.price !== lastPrice) {
      setFlash(live.price > lastPrice ? "up" : "down");
      const id = setTimeout(() => setFlash(null), 600);
      setLastPrice(live.price);
      return () => clearTimeout(id);
    }
    setLastPrice(live.price);
  }, [live?.price, lastPrice]);

  return (
    <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm text-zinc-500">{a.name}</div>
          <h2 className="text-3xl font-semibold tracking-tight">{a.ticker}</h2>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <div
              className={
                "text-2xl font-semibold transition-colors duration-300 " +
                (flash === "up" ? "text-emerald-600" : flash === "down" ? "text-rose-600" : "")
              }
            >
              ${displayPrice.toFixed(2)}
            </div>
            <div className={up ? "text-emerald-600" : "text-rose-600"}>
              {up ? "▲" : "▼"} {displayChangePct.toFixed(2)}%
              {periodLabel && (
                <span className="ml-1 text-xs font-mono text-zinc-500">· {periodLabel}</span>
              )}
            </div>
            <LivePricePill
              status={liveStatus}
              hasRecentTick={live != null}
              ageSec={ageSec}
            />
          </div>
        </div>
        <div data-tour="signal-badge">
          <SignalBadge signal={a.signal.signal} confidence={a.signal.confidence} />
        </div>
      </div>

      {/* Big chart */}
      <div data-tour="price-chart" className="mt-5">
        <PriceChart
          ticker={a.ticker}
          data={a.priceHistory}
          onRangeStartChange={onRangeStartChange}
        />
      </div>

      {/* Buy / Hold / Sell distribution right under the chart */}
      <div data-tour="signal-bar">
        <SignalBar signal={a.signal} />
      </div>

      {/* Stats grid */}
      <div data-tour="stats-grid" className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat term="52W_HIGH" label="52W HIGH" value={`$${t.hi52w.toFixed(2)}`} />
        <Stat term="52W_LOW" label="52W LOW" value={`$${t.lo52w.toFixed(2)}`} />
        <Stat term="SMA_50" label="SMA 50" value={t.sma50 != null ? `$${t.sma50.toFixed(2)}` : "—"} />
        <Stat term="SMA_200" label="SMA 200" value={t.sma200 != null ? `$${t.sma200.toFixed(2)}` : "—"} />
        <Stat term="RSI" label="RSI(14)" value={t.rsi14 != null ? t.rsi14.toFixed(1) : "—"} />
        <Stat term="TREND" label="TREND" value={t.trend} emphasis={trendColor(t.trend)} />
      </div>

      {/* Key fundamentals — parallel to the technicals row above. Valuation
          multiples and headline growth/profitability at a glance. */}
      <div data-tour="fundamentals-grid" className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat term="PE" label="P/E" value={fmtNum(a.fundamentals.peRatio)} />
        <Stat term="FORWARD_PE" label="FWD P/E" value={fmtNum(a.fundamentals.forwardPE)} />
        <Stat term="PEG" label="PEG" value={fmtNum(a.fundamentals.pegRatio)} />
        <Stat term="EPS_TTM" label="EPS (TTM)" value={fmtEps(a.fundamentals.epsTtm)} />
        <Stat term="REVENUE_GROWTH" label="REV GROWTH" value={fmtPct(a.fundamentals.revenueGrowthYoY)} emphasis={growthColor(a.fundamentals.revenueGrowthYoY)} />
        <Stat term="PROFIT_MARGIN" label="PROFIT MARGIN" value={fmtPct(a.fundamentals.profitMargin)} emphasis={growthColor(a.fundamentals.profitMargin)} />
      </div>

      {/* Time-machine backtest — "if you'd bought this N years ago, you'd
          have X today, max drawdown Y". Purely educational, uses the 5Y
          priceHistory already on the payload + a lazy SPY fetch. */}
      <TimeMachineBacktest ticker={a.ticker} priceHistory={a.priceHistory} />

      {/* Nudge beginners to use the Educator when they see unfamiliar terms. */}
      <div className="mt-5">
        <EducatorNudge />
      </div>

      {/* Pre-buy checklist — placed BEFORE "Why this signal?" so users see the
          concrete pass/warn/fail items first, then the synthesized rationale. */}
      <div data-tour="checklist" className="mt-5">
        <ChecklistSection checklist={a.checklist} />
      </div>

      {/* Why this signal? */}
      <div data-tour="why-signal" className="mt-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 p-4">
        <h3 className="font-semibold text-sm mb-2">Why this signal?</h3>
        <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-3">
          {a.signal.beginnerExplanation}
        </p>
        <ul className="space-y-1.5 text-sm">
          {a.signal.reasons.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-zinc-400">•</span>
              <span className="text-zinc-700 dark:text-zinc-300">{r}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Per-agent breakdown */}
      <div data-tour="agent-findings" className="mt-4 grid sm:grid-cols-3 gap-3">
        <Finding title="Fundamentals" verdict={a.fundamentals.verdict} rationale={a.fundamentals.rationale} />
        <Finding title="Technicals" verdict={a.technicals.verdict} rationale={a.technicals.rationale} />
        <Finding title="News / Sentiment" verdict={a.news.verdict} rationale={a.news.rationale} />
      </div>

      {/* Forward plans + catalysts + headlines — previously only on the
          detail page. Inlined so everything lives on one scroll. */}
      <div data-tour="whats-next" className="mt-6 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        <h3 className="font-semibold text-sm">What&apos;s next for this company</h3>
        <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">
          {a.news.forwardPlans}
        </p>

        {a.news.catalysts.length > 0 && (
          <>
            <h4 className="text-xs uppercase tracking-wide text-zinc-500 mt-3">Watch for</h4>
            <ul className="list-disc ml-5 text-sm text-zinc-700 dark:text-zinc-300">
              {a.news.catalysts.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </>
        )}

        {a.news.headlines.length > 0 && (
          <>
            <h4 className="text-xs uppercase tracking-wide text-zinc-500 mt-3">Recent headlines</h4>
            <ul className="text-sm space-y-1 mt-1">
              {a.news.headlines.map((h, i) => (
                <li key={i}>
                  <a
                    href={h.link}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline text-zinc-700 dark:text-zinc-300"
                  >
                    {h.title}
                  </a>
                  <span className="text-zinc-500"> — {h.publisher}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Decision journal — user writes their thesis after reading the
          analysis; we replay it back to them later at /decisions. */}
      <DecisionJournalForm a={a} />

      <p className="mt-4 text-[11px] text-zinc-500">{a.disclaimer}</p>
    </section>
  );
}

function Stat({
  label,
  value,
  emphasis,
  term,
}: {
  label: string;
  value: string;
  emphasis?: string;
  term?: GlossaryTerm;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">
        {term ? <GlossaryLabel term={term}>{label}</GlossaryLabel> : label}
      </div>
      <div className={`text-sm font-semibold ${emphasis ?? ""}`}>{value}</div>
    </div>
  );
}

function trendColor(t: "up" | "down" | "sideways"): string {
  if (t === "up") return "text-emerald-600";
  if (t === "down") return "text-rose-600";
  return "text-zinc-500";
}

// Fundamentals formatters. All handle nulls (metric unavailable for a ticker)
// and return a consistent em-dash so the grid stays visually aligned.
function fmtNum(n: number | null, digits = 2): string {
  return n == null ? "—" : n.toFixed(digits);
}
function fmtPct(n: number | null, digits = 1): string {
  // Source stores fractions (0.12 = 12%). Multiply for display.
  return n == null ? "—" : `${(n * 100).toFixed(digits)}%`;
}
function fmtEps(n: number | null): string {
  if (n == null) return "—";
  // Negative EPS (losses) should read as "-$1.23" not "$-1.23".
  return `${n < 0 ? "-$" : "$"}${Math.abs(n).toFixed(2)}`;
}
// Green when clearly healthy, red when negative/shrinking. Zero-ish stays
// neutral so we don't over-colorize noisy mid-range readings.
function growthColor(n: number | null): string | undefined {
  if (n == null) return undefined;
  if (n < 0) return "text-rose-600";
  if (n >= 0.1) return "text-emerald-600";
  return undefined;
}

function Finding({
  title,
  verdict,
  rationale,
}: {
  title: string;
  verdict: "strong" | "neutral" | "weak";
  rationale: string;
}) {
  const color =
    verdict === "strong"
      ? "text-emerald-600"
      : verdict === "weak"
      ? "text-rose-600"
      : "text-zinc-500";
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold">{title}</span>
        <span className={`font-semibold ${color}`}>{verdict}</span>
      </div>
      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{rationale}</p>
    </div>
  );
}
