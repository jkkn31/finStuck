// "If you had bought $X of this stock N years ago..." card.
//
// Purely a teaching tool: uses the 5Y daily history already on the analysis
// payload, plus a lazy SPY fetch for a market benchmark. No dividends, taxes,
// or slippage — the copy says so explicitly so users don't compare us to
// total-return numbers and get confused.
//
// Beginner view: 4 plain-English numbers with one-line explainers.
// Pro view (toggle): annualized return, volatility, worst month.

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatMonths,
  runBacktest,
  sliceForRange,
  type BacktestPoint,
  type BacktestRange,
} from "@/lib/backtest";
import { useBenchmarkHistory } from "@/hooks/useBenchmarkHistory";
import GlossaryLabel from "./GlossaryLabel";

type Props = {
  ticker: string;
  priceHistory: BacktestPoint[];
};

const AMOUNT_KEY = "invest.backtest.amount.v1";
const PROVIEW_KEY = "invest.backtest.proview.v1";

function readNumber(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    const n = raw == null ? NaN : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}
function readBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === "1") return true;
    if (raw === "0") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

export default function TimeMachineBacktest({ ticker, priceHistory }: Props) {
  // localStorage-backed inputs, hydrated after mount to avoid SSR mismatch.
  const [amount, setAmount] = useState<number>(100);
  const [proView, setProView] = useState<boolean>(false);
  const [range, setRange] = useState<BacktestRange>("5y");
  useEffect(() => {
    setAmount(readNumber(AMOUNT_KEY, 100));
    setProView(readBool(PROVIEW_KEY, false));
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(AMOUNT_KEY, String(amount));
    } catch {
      // ignore
    }
  }, [amount]);
  useEffect(() => {
    try {
      window.localStorage.setItem(PROVIEW_KEY, proView ? "1" : "0");
    } catch {
      // ignore
    }
  }, [proView]);

  const sliced = useMemo(() => sliceForRange(priceHistory, range), [priceHistory, range]);
  const stockResult = useMemo(() => runBacktest(sliced, amount), [sliced, amount]);

  // SPY for the same window. Only fire the fetch once the card is on screen;
  // `enabled` stays true as long as this component is mounted. If SPY fetch
  // errors (e.g. offline), we gracefully degrade to "—" for the benchmark.
  const benchRange = range === "ytd" ? "1y" : range;
  const spy = useBenchmarkHistory("SPY", benchRange, true);
  const spyResult = useMemo(() => {
    if (!spy.data) return null;
    const spySliced = sliceForRange(spy.data, range);
    return runBacktest(spySliced, amount);
  }, [spy.data, range, amount]);

  if (!stockResult) {
    return (
      <section
        data-tour="time-machine"
        className="mt-5 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4"
      >
        <h3 className="font-semibold text-sm">Time machine</h3>
        <p className="mt-2 text-sm text-zinc-500">
          Not enough price history yet to run a backtest on this ticker.
        </p>
      </section>
    );
  }

  const up = stockResult.totalReturnPct >= 0;
  const vsBench = spyResult
    ? stockResult.totalReturnPct - spyResult.totalReturnPct
    : null;

  return (
    <section
      data-tour="time-machine"
      className="mt-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-950/40 dark:to-zinc-900 p-4"
    >
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h3 className="font-semibold text-sm">
          Time machine <span className="text-zinc-500 font-normal">· if you had bought this</span>
        </h3>
        <div className="flex items-center gap-2 text-xs">
          <RangeToggle range={range} onChange={setRange} />
          <label className="flex items-center gap-1 cursor-pointer select-none text-zinc-500">
            <input
              type="checkbox"
              checked={proView}
              onChange={(e) => setProView(e.target.checked)}
              className="accent-emerald-600"
            />
            Pro view
          </label>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm flex-wrap">
        <span className="text-zinc-600 dark:text-zinc-400">If I had bought</span>
        <span className="inline-flex items-center rounded-md border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 bg-white dark:bg-zinc-900">
          <span className="text-zinc-500 mr-0.5">$</span>
          <input
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0) setAmount(Math.round(n));
            }}
            className="w-20 bg-transparent outline-none text-sm"
            aria-label="Hypothetical amount in dollars"
          />
        </span>
        <span className="text-zinc-600 dark:text-zinc-400">
          of <span className="font-semibold">{ticker}</span> on{" "}
          <span className="font-mono">{stockResult.startDate}</span>…
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile
          label="Worth today"
          value={`$${formatDollar(stockResult.finalValue)}`}
          sub={
            <>
              <span className={up ? "text-emerald-600" : "text-rose-600"}>
                {up ? "+" : ""}
                {stockResult.totalReturnPct.toFixed(1)}%
              </span>{" "}
              total return
            </>
          }
          hint="This ignores dividends, taxes, and trading fees."
        />
        <Tile
          label={<GlossaryLabel term="MAX_DRAWDOWN">Scariest drop</GlossaryLabel>}
          value={`${stockResult.maxDrawdownPct.toFixed(1)}%`}
          sub={
            stockResult.drawdownFromDate && stockResult.drawdownToDate ? (
              <>
                <span className="font-mono">{stockResult.drawdownFromDate}</span> →{" "}
                <span className="font-mono">{stockResult.drawdownToDate}</span>
              </>
            ) : (
              <>no meaningful drop in this window</>
            )
          }
          hint="How much you'd have lost if you panic-sold at the worst moment."
          emphasis="text-rose-600"
        />
        <Tile
          label={<GlossaryLabel term="RECOVERY_MONTHS">Recovery time</GlossaryLabel>}
          value={formatMonths(stockResult.recoveryMonths)}
          sub={
            stockResult.recoveryMonths == null
              ? "still below the old peak"
              : "to get back to the old peak"
          }
          hint="How long you'd have waited to break even after the worst drop."
        />
        <Tile
          label="vs S&P 500 (SPY)"
          value={
            spy.loading
              ? "…"
              : spyResult
              ? `${(vsBench ?? 0) >= 0 ? "+" : ""}${(vsBench ?? 0).toFixed(1)}%`
              : "—"
          }
          sub={
            spyResult ? (
              <>SPY did {spyResult.totalReturnPct.toFixed(1)}%</>
            ) : spy.error ? (
              <>couldn&apos;t load SPY</>
            ) : (
              <>market benchmark</>
            )
          }
          hint="Extra return vs just buying the S&P 500 over the same period."
          emphasis={vsBench != null ? (vsBench >= 0 ? "text-emerald-600" : "text-rose-600") : undefined}
        />
      </div>

      {proView && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <ProTile
            label="Annualized return (CAGR)"
            value={`${stockResult.annualizedReturnPct.toFixed(2)}%`}
          />
          <ProTile
            label="Volatility (annualized σ)"
            value={`${stockResult.volatilityPct.toFixed(1)}%`}
          />
          <ProTile
            label="Worst ~21-day return"
            value={`${stockResult.worstMonthPct.toFixed(1)}%`}
          />
        </div>
      )}

      <p className="mt-3 text-[11px] text-zinc-500">
        Educational only. Past performance doesn&apos;t predict future returns. Dividends
        reinvested would change these numbers.
      </p>
    </section>
  );
}

function RangeToggle({
  range,
  onChange,
}: {
  range: BacktestRange;
  onChange: (r: BacktestRange) => void;
}) {
  const opts: BacktestRange[] = ["ytd", "1y", "5y"];
  return (
    <div className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {opts.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={
            "px-2 py-0.5 font-mono uppercase " +
            (range === o
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800")
          }
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  hint,
  emphasis,
}: {
  label: React.ReactNode;
  value: string;
  sub?: React.ReactNode;
  hint?: string;
  emphasis?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`text-lg font-semibold ${emphasis ?? ""}`}>{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>}
      {hint && (
        <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 leading-snug">
          {hint}
        </div>
      )}
    </div>
  );
}

function ProTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 dark:border-zinc-700 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-sm font-mono">{value}</div>
    </div>
  );
}

function formatDollar(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
