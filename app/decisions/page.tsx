// /decisions — history view for the decision journal.
//
// Client-side page: reads entries from localStorage, lazy-fetches 1Y daily
// history for each unique ticker + SPY via the existing /api/benchmark route,
// and computes "how's it looking" deltas per entry.
//
// Deltas show:
//   - what the stock did since the user wrote their thesis
//   - what SPY did over the same window (did they beat the market?)

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDecisionJournal, type JournalEntry } from "@/hooks/useDecisionJournal";

type Point = { date: string; close: number };

// Fetch once per ticker, in-memory session cache.
const historyCache = new Map<string, Point[]>();

async function fetchHistory(ticker: string): Promise<Point[]> {
  const cached = historyCache.get(ticker);
  if (cached) return cached;
  const res = await fetch(`/api/benchmark/${encodeURIComponent(ticker)}?range=1y`);
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  const json = (await res.json()) as { data: Point[] };
  historyCache.set(ticker, json.data);
  return json.data;
}

function closeNearest(points: Point[], dateMs: number): number | null {
  if (!points || points.length === 0) return null;
  const iso = new Date(dateMs).toISOString().slice(0, 10);
  // Binary search would be fine, but linear is cheap enough for 1Y of daily
  // closes (~250 points) and never runs in a hot loop.
  let best: Point | null = null;
  for (const p of points) {
    if (p.date <= iso) best = p;
    else break;
  }
  return best ? best.close : points[0].close;
}

export default function DecisionsPage() {
  const { entries, remove, hydrated } = useDecisionJournal();
  const [histories, setHistories] = useState<Record<string, Point[]>>({});
  const [spy, setSpy] = useState<Point[] | null>(null);
  const [loading, setLoading] = useState(false);

  const uniqueTickers = useMemo(
    () => [...new Set(entries.map((e) => e.ticker.toUpperCase()))],
    [entries],
  );

  useEffect(() => {
    if (!hydrated || entries.length === 0) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const results = await Promise.all([
          fetchHistory("SPY"),
          ...uniqueTickers.map((t) => fetchHistory(t).then((h) => [t, h] as const)),
        ]);
        if (cancelled) return;
        const [spyHist, ...tickerHists] = results as [
          Point[],
          ...Array<readonly [string, Point[]]>,
        ];
        setSpy(spyHist);
        const byTicker: Record<string, Point[]> = {};
        for (const [t, h] of tickerHists) byTicker[t] = h;
        setHistories(byTicker);
      } catch {
        // Graceful degrade — the page still renders entries, just without deltas.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, entries.length, uniqueTickers]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My decisions</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Your saved take on each stock, side-by-side with what actually happened.
            Saved only in this browser.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline underline-offset-2"
        >
          ← back to dashboard
        </Link>
      </header>

      {!hydrated && (
        <div className="text-sm text-zinc-500">Loading your entries…</div>
      )}

      {hydrated && entries.length === 0 && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No decisions saved yet. Analyze a stock and scroll to{" "}
            <span className="font-semibold">Own your decision</span> to write your first
            entry.
          </p>
          <Link
            href="/"
            className="mt-3 inline-block text-sm text-emerald-700 dark:text-emerald-400 underline underline-offset-2"
          >
            Go to dashboard →
          </Link>
        </div>
      )}

      {hydrated && entries.length > 0 && (
        <ul className="flex flex-col gap-3">
          {entries.map((e) => (
            <EntryCard
              key={e.id}
              e={e}
              tickerHist={histories[e.ticker.toUpperCase()] ?? null}
              spyHist={spy}
              loading={loading}
              onDelete={() => remove(e.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EntryCard({
  e,
  tickerHist,
  spyHist,
  loading,
  onDelete,
}: {
  e: JournalEntry;
  tickerHist: Point[] | null;
  spyHist: Point[] | null;
  loading: boolean;
  onDelete: () => void;
}) {
  const currentPrice =
    tickerHist && tickerHist.length > 0 ? tickerHist[tickerHist.length - 1].close : null;
  const tickerReturn =
    currentPrice != null ? (currentPrice / e.snapshot.price - 1) * 100 : null;

  const spyAtSave = spyHist ? closeNearest(spyHist, e.savedAt) : null;
  const spyNow = spyHist && spyHist.length > 0 ? spyHist[spyHist.length - 1].close : null;
  const spyReturn =
    spyAtSave != null && spyNow != null ? (spyNow / spyAtSave - 1) * 100 : null;

  const vsSpy =
    tickerReturn != null && spyReturn != null ? tickerReturn - spyReturn : null;

  const saved = new Date(e.savedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const recheckDate = new Date(e.reconsiderAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const isDue = e.reconsiderAt <= Date.now();
  const intentColor =
    e.intent === "buy"
      ? "text-emerald-700 dark:text-emerald-400"
      : e.intent === "skip"
      ? "text-rose-700 dark:text-rose-400"
      : "text-zinc-600 dark:text-zinc-300";
  const intentLabel =
    e.intent === "buy" ? "buying" : e.intent === "skip" ? "skipping" : "watching";

  return (
    <li className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/`}
              className="text-xl font-semibold tracking-tight hover:underline"
            >
              {e.ticker}
            </Link>
            <span className="text-xs text-zinc-500">·</span>
            <span className={`text-xs font-medium ${intentColor}`}>{intentLabel}</span>
            <span className="text-xs text-zinc-500">
              · saved {saved} at ${e.snapshot.price.toFixed(2)}
            </span>
            <span className="text-xs text-zinc-500">
              · signal was {e.snapshot.signal} ({Math.round(e.snapshot.confidence * 100)}%)
            </span>
          </div>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            &ldquo;{e.thesis}&rdquo;
          </p>
          {e.invalidation && (
            <p className="mt-1 text-xs text-zinc-500">
              Would change my mind if: {e.invalidation}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 text-xs text-zinc-400 hover:text-rose-600"
          aria-label="Delete entry"
        >
          Delete
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Delta
          label="Now"
          value={currentPrice != null ? `$${currentPrice.toFixed(2)}` : loading ? "…" : "—"}
        />
        <Delta
          label="Since you wrote this"
          value={
            tickerReturn != null
              ? `${tickerReturn >= 0 ? "+" : ""}${tickerReturn.toFixed(1)}%`
              : loading
              ? "…"
              : "—"
          }
          emphasis={
            tickerReturn == null
              ? undefined
              : tickerReturn >= 0
              ? "text-emerald-600"
              : "text-rose-600"
          }
        />
        <Delta
          label="SPY over same period"
          value={
            spyReturn != null
              ? `${spyReturn >= 0 ? "+" : ""}${spyReturn.toFixed(1)}%`
              : loading
              ? "…"
              : "—"
          }
        />
        <Delta
          label="You vs market"
          value={
            vsSpy != null
              ? `${vsSpy >= 0 ? "+" : ""}${vsSpy.toFixed(1)}%`
              : loading
              ? "…"
              : "—"
          }
          emphasis={
            vsSpy == null
              ? undefined
              : vsSpy >= 0
              ? "text-emerald-600"
              : "text-rose-600"
          }
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        <span className={isDue ? "text-amber-700 dark:text-amber-400 font-medium" : "text-zinc-500"}>
          {isDue ? "Re-check is due" : "Re-check on"} {recheckDate}
        </span>
        <span className="text-zinc-400">
          Current price is an approximation from daily close. Dividends not included.
        </span>
      </div>
    </li>
  );
}

function Delta({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: string;
}) {
  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`text-sm font-semibold ${emphasis ?? ""}`}>{value}</div>
    </div>
  );
}
