// Top-movers table. No sortable headers — the page already sorted by the
// selected period's return. Each row shows the technical-health signals
// that drove the baseline filter (price-vs-SMA50, RSI, volume trend) plus
// an earnings-soon badge when the next report is ≤30 days out.

"use client";

import Link from "next/link";
import type { PeriodKey, ScreenerRow } from "@/lib/screener";

type Props = {
  rows: ScreenerRow[];
  period: PeriodKey;
  loading: boolean;
};

export default function ScreenerTable({ rows, period, loading }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-sm text-zinc-500">
        {loading
          ? "Loading screener data… rows will stream in as Yahoo responds."
          : "No healthy movers for this period. Try a different period or check back after market hours."}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-950/50 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2 text-left w-10">#</th>
              <th className="px-3 py-2 text-left">Ticker</th>
              <th className="px-3 py-2 text-center w-14" title="Passes all 4 health checks?">Health</th>
              <th className="px-3 py-2 text-left hidden sm:table-cell">Sector</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-right">{labelFor(period)}</th>
              <th className="px-3 py-2 text-right hidden md:table-cell" title="Price vs 50-day moving average">vs&nbsp;SMA50</th>
              <th className="px-3 py-2 text-right hidden md:table-cell">RSI</th>
              <th className="px-3 py-2 text-right hidden lg:table-cell" title="20-day avg volume vs prior 20 days">Vol&nbsp;trend</th>
              <th className="px-3 py-2 text-center hidden lg:table-cell">Earnings</th>
              <th className="px-3 py-2 text-right" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const ret = returnForPeriod(r, period);
              return (
                <tr
                  key={r.ticker}
                  className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                >
                  <td className="px-3 py-2 text-xs text-zinc-400 font-mono">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-mono font-semibold">{r.ticker}</div>
                    <div className="text-[10px] text-zinc-500 truncate max-w-[220px]">
                      {r.name}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <HealthBadge row={r} />
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400 hidden sm:table-cell">
                    {r.sector ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {r.price != null ? `$${r.price.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={"font-mono text-sm font-semibold " + moveClass(ret)}>
                      {fmtReturn(ret)}
                    </span>
                  </td>
                  <td className={"px-3 py-2 text-right font-mono text-xs hidden md:table-cell " + smaClass(r.priceVsSma50Pct)}>
                    {fmtSigned(r.priceVsSma50Pct)}
                  </td>
                  <td className={"px-3 py-2 text-right font-mono text-xs hidden md:table-cell " + rsiClass(r.rsi14)}>
                    {fmtNum(r.rsi14, 0)}
                  </td>
                  <td className={"px-3 py-2 text-right font-mono text-xs hidden lg:table-cell " + volClass(r.volumeTrendPct)}>
                    {fmtSigned(r.volumeTrendPct)}
                  </td>
                  <td className="px-3 py-2 text-center hidden lg:table-cell">
                    <EarningsBadge days={r.daysToEarnings} date={r.nextEarningsDate} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/?t=${encodeURIComponent(r.ticker)}`}
                      className="inline-block rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-2.5 py-1 text-xs font-medium"
                    >
                      Analyze
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {loading && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 px-3 py-2 text-[11px] text-zinc-500">
          Streaming… rankings update as each ticker resolves.
        </div>
      )}
    </div>
  );
}

function returnForPeriod(row: ScreenerRow, p: PeriodKey): number | null {
  switch (p) {
    case "1d":
      return row.return1d;
    case "1w":
      return row.return1w;
    case "1m":
      return row.return1m;
    case "ytd":
      return row.returnYtd;
    case "1y":
      return row.return1y;
  }
}

function labelFor(p: PeriodKey): string {
  return p === "1d"
    ? "1D move"
    : p === "1w"
    ? "1W move"
    : p === "1m"
    ? "1M move"
    : p === "ytd"
    ? "YTD"
    : "1Y move";
}

function fmtReturn(n: number | null): string {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(1)}%`;
}

function fmtSigned(n: number | null): string {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function fmtNum(n: number | null, digits = 2): string {
  if (n == null) return "—";
  return n.toFixed(digits);
}

function moveClass(n: number | null): string {
  if (n == null) return "text-zinc-500";
  if (n > 0) return "text-emerald-600";
  if (n < 0) return "text-rose-600";
  return "text-zinc-500";
}

function smaClass(n: number | null): string {
  if (n == null) return "";
  return n > 0 ? "text-emerald-600" : "text-rose-600";
}

function rsiClass(rsi: number | null): string {
  if (rsi == null) return "";
  if (rsi >= 70) return "text-rose-600"; // overbought warning
  if (rsi <= 30) return "text-emerald-600";
  return "";
}

function volClass(v: number | null): string {
  if (v == null) return "";
  return v > 0 ? "text-emerald-600" : "text-rose-600";
}

function HealthBadge({ row }: { row: ScreenerRow }) {
  const failures = healthFailures(row);
  if (row.isHealthy) {
    return (
      <span
        title="Passes all health checks: uptrend, healthy RSI, rising volume, profitable"
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs"
        aria-label="Healthy"
      >
        ✓
      </span>
    );
  }
  const tooltip = failures.length > 0 ? `Fails: ${failures.join(", ")}` : "Unknown";
  return (
    <span
      title={tooltip}
      className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-xs"
      aria-label={tooltip}
    >
      ⚠
    </span>
  );
}

// Return a list of human-readable reasons the row doesn't pass the baseline.
// Mirrors the logic in passesHealthyBaseline but describes *which* check
// tripped, so the tooltip can be precise.
function healthFailures(row: ScreenerRow): string[] {
  const out: string[] = [];
  if (row.profitMargin == null || row.profitMargin <= 0) out.push("unprofitable");
  if (row.priceVsSma50Pct == null || row.priceVsSma50Pct <= 0) out.push("below SMA50");
  if (row.rsi14 == null) out.push("RSI unknown");
  else if (row.rsi14 < 30) out.push("oversold (RSI<30)");
  else if (row.rsi14 > 70) out.push("overbought (RSI>70)");
  if (row.volumeTrendPct == null || row.volumeTrendPct <= 0) out.push("volume fading");
  return out;
}

function EarningsBadge({ days, date }: { days: number | null; date: string | null }) {
  if (days == null || date == null) {
    return <span className="text-[10px] text-zinc-400">—</span>;
  }
  const cls =
    days <= 7
      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
      : days <= 30
      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  return (
    <span
      title={`Next earnings: ${date}`}
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-mono ${cls}`}
    >
      {days === 0 ? "today" : `${days}d`}
    </span>
  );
}
