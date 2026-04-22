// Fetches daily close history for a benchmark ticker (we default to SPY) and
// caches the response in-memory for the session. The backtest card only
// needs this when the user actually opens it, so we keep the fetch lazy and
// guarded behind an `enabled` flag.

"use client";

import { useEffect, useState } from "react";

type Point = { date: string; close: number };
type Range = "1y" | "5y";

// Session-scoped cache so switching between tickers doesn't hammer Yahoo.
const cache = new Map<string, Point[]>();

export function useBenchmarkHistory(
  ticker: string,
  range: Range,
  enabled: boolean,
) {
  const [data, setData] = useState<Point[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const key = `${ticker}:${range}`;
    const cached = cache.get(key);
    if (cached) {
      setData(cached);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/benchmark/${encodeURIComponent(ticker)}?range=${range}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
        const json = (await res.json()) as { data: Point[] };
        if (cancelled) return;
        cache.set(key, json.data);
        setData(json.data);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, range, enabled]);

  return { data, error, loading };
}
