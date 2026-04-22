// /screener — "top movers among fundamentally healthy S&P 500 stocks".
//
// Intentionally beginner-shaped: no sliders, no custom filters. Pick a
// period (1D / 1W / 1M / 1Y), optionally flip between gainers and losers,
// see the top 25. The "fundamentally healthy" baseline is hardcoded — any
// name that's losing money, drowning in debt, or illiquid is filtered out
// before the ranking, so the list can't hand beginners a pump-and-dump.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ScreenerTable from "@/components/ScreenerTable";
import {
  PERIODS,
  type PeriodKey,
  type ScreenerRow,
} from "@/lib/screener";

const TOP_N = 25;

export default function ScreenerPage() {
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("1d");
  const [direction, setDirection] = useState<"gainers" | "losers">("gainers");
  const abortRef = useRef<AbortController | null>(null);

  const runScreener = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    setRows([]);
    setProgress(null);

    try {
      const res = await fetch("/api/screener", { signal: ctrl.signal });
      if (!res.body) throw new Error("no stream body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const ev = parseSSE(raw);
          if (!ev) continue;
          if (ev.event === "row") {
            const row = ev.data as ScreenerRow;
            setRows((prev) => [...prev, row]);
          } else if (ev.event === "progress") {
            setProgress(ev.data as { completed: number; total: number });
          } else if (ev.event === "start") {
            setProgress({ completed: 0, total: (ev.data as { total: number }).total });
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runScreener();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rank by the selected period's return, across the WHOLE universe — the
  // health checks are shown as a per-row badge rather than a hard filter,
  // because filtering too aggressively leaves the user with 3-5 names and
  // they'd rather see the top 25 movers with quality indicators.
  // "Gainers" = highest positive first, "losers" = most negative first.
  // Ties broken by volume-trend conviction.
  const ranked = useMemo(() => {
    const withReturn = rows
      .filter((r) => !r.error)
      .map((r) => ({ row: r, ret: returnForPeriod(r, period) }))
      .filter((x) => x.ret != null) as { row: ScreenerRow; ret: number }[];

    withReturn.sort((a, b) => {
      const diff = direction === "gainers" ? b.ret - a.ret : a.ret - b.ret;
      if (Math.abs(diff) > 1e-6) return diff;
      return (b.row.volumeTrendPct ?? 0) - (a.row.volumeTrendPct ?? 0);
    });

    // For gainers, keep the positive ones; for losers, keep the negative
    // ones. A row with 0% return in a gainers list isn't really a "mover".
    const directional = withReturn.filter((x) =>
      direction === "gainers" ? x.ret > 0 : x.ret < 0,
    );
    return directional.slice(0, TOP_N).map((x) => x.row);
  }, [rows, period, direction]);

  const healthyCount = ranked.filter((r) => r.isHealthy).length;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Screener</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Top {TOP_N} movers in the S&amp;P 500 top 100 for the selected
            period. The <span className="font-semibold">health</span> column
            tells you which ones also pass all four quality checks (uptrend,
            healthy RSI, rising volume, profitable).
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {progress && (
            <span className="text-zinc-500 font-mono text-xs">
              {loading
                ? `loaded ${progress.completed}/${progress.total}`
                : `${ranked.length} shown · ${healthyCount} pass all health checks`}
            </span>
          )}
          <button
            type="button"
            onClick={runScreener}
            disabled={loading}
            className="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          <Link
            href="/"
            className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline underline-offset-2"
          >
            ← back to dashboard
          </Link>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 p-3 text-sm text-rose-800 dark:text-rose-200">
          Screener failed: {error}
        </div>
      )}

      {/* Period tabs + gainers/losers toggle. Two visible controls, nothing else. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1">
          {(Object.keys(PERIODS) as PeriodKey[]).map((p) => {
            const active = period === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                title={PERIODS[p].description}
                className={
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors " +
                  (active
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white"
                    : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800")
                }
              >
                {PERIODS[p].label}
              </button>
            );
          })}
        </div>

        <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1">
          <button
            type="button"
            onClick={() => setDirection("gainers")}
            className={
              "rounded-md px-3 py-1 text-xs font-medium transition-colors " +
              (direction === "gainers"
                ? "bg-emerald-600 text-white"
                : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800")
            }
          >
            ▲ Gainers
          </button>
          <button
            type="button"
            onClick={() => setDirection("losers")}
            className={
              "rounded-md px-3 py-1 text-xs font-medium transition-colors " +
              (direction === "losers"
                ? "bg-rose-600 text-white"
                : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800")
            }
          >
            ▼ Losers
          </button>
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        <span className="font-semibold">Health checks:</span> price above the
        50-day moving average (uptrend), RSI between 30 and 70 (not
        overbought or oversold), volume rising vs the prior 20 days
        (conviction), and the company is TTM-profitable. Rows that pass all
        four get a green check; any failure drops them to an amber warning
        — still shown, so you can see the whole mover list.
      </p>

      <ScreenerTable rows={ranked} period={period} loading={loading} />

      <p className="text-[11px] text-zinc-500">
        Educational only. Past moves don&apos;t predict future moves. &quot;Fundamentally
        healthy&quot; is a filter, not a recommendation — always verify with the
        full analysis before investing.
      </p>
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

function parseSSE(raw: string): { event: string; data: unknown } | null {
  const lines = raw.split("\n");
  let event = "message";
  const dataParts: string[] = [];
  for (const l of lines) {
    if (l.startsWith("event:")) event = l.slice(6).trim();
    else if (l.startsWith("data:")) dataParts.push(l.slice(5).trim());
  }
  if (dataParts.length === 0) return null;
  try {
    return { event, data: JSON.parse(dataParts.join("\n")) };
  } catch {
    return null;
  }
}
