// Tiny localStorage-backed MRU (most-recently-used) list of tickers. Each
// ticker analyzed bubbles to the front; the list is capped at `max` entries.
// Storage is per-browser and persists across sessions.
//
// Intentionally client-only: the hook returns an empty list on the server
// pass to avoid hydration mismatch, then repopulates after mount.

"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "invest.recentTickers.v1";
const DEFAULT_MAX = 12;

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(list: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Quota exceeded / private mode — ignore, not critical.
  }
}

export function useRecentTickers(max = DEFAULT_MAX) {
  const [recent, setRecent] = useState<string[]>([]);

  // Read once on mount (post-hydration).
  useEffect(() => {
    setRecent(read());
  }, []);

  const push = useCallback(
    (tickers: string[]) => {
      const clean = tickers
        .map((t) => t.trim().toUpperCase())
        .filter((t) => /^[A-Z.-]{1,10}$/.test(t)); // sanity gate: letters, dots, dashes
      if (clean.length === 0) return;
      setRecent((prev) => {
        // Put new ones at the front, dedupe against the rest, cap at max.
        const next = [...new Set([...clean, ...prev])].slice(0, max);
        write(next);
        return next;
      });
    },
    [max],
  );

  const remove = useCallback((ticker: string) => {
    setRecent((prev) => {
      const next = prev.filter((t) => t !== ticker);
      write(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    write([]);
    setRecent([]);
  }, []);

  return { recent, push, remove, clear };
}
