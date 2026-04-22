// localStorage-backed history of completed analyses. Every successful run
// is snapshotted here so the user can revisit it later without re-spending
// LLM credits. Capped LRU at 30 entries to stay well under the ~5 MB
// per-origin quota (each entry is ~20-30 KB, dominated by priceHistory).
//
// Follows the same hydration pattern as useDecisionJournal: returns an empty
// list on SSR and first render, then repopulates after mount to avoid
// hydration mismatch.

"use client";

import { useCallback, useEffect, useState } from "react";
import type { StockAnalysis } from "@/lib/schemas";

const KEY = "invest.history.v1";
const MAX_ENTRIES = 30;

export type HistoryEntry = {
  id: string;        // "h_<base36 time>_<rand>"
  savedAt: number;   // ms epoch
  tickers: string[]; // order as analyzed
  analyses: Record<string, StockAnalysis>;
};

function read(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is HistoryEntry =>
        e &&
        typeof e.id === "string" &&
        typeof e.savedAt === "number" &&
        Array.isArray(e.tickers) &&
        e.analyses &&
        typeof e.analyses === "object",
    );
  } catch {
    return [];
  }
}

function write(entries: HistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Quota exceeded / private mode. Try shedding the oldest half and
    // retrying once. If that still fails, silently drop — history is a
    // nice-to-have, not critical.
    try {
      const trimmed = entries.slice(0, Math.floor(entries.length / 2));
      window.localStorage.setItem(KEY, JSON.stringify(trimmed));
    } catch {
      // give up
    }
  }
}

function makeId(): string {
  return `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useAnalysisHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setEntries(read());
    setHydrated(true);
  }, []);

  const add = useCallback(
    (record: Omit<HistoryEntry, "id" | "savedAt">) => {
      const full: HistoryEntry = {
        ...record,
        id: makeId(),
        savedAt: Date.now(),
      };
      setEntries((prev) => {
        const next = [full, ...prev].slice(0, MAX_ENTRIES);
        write(next);
        return next;
      });
      return full;
    },
    [],
  );

  const remove = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      write(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    write([]);
    setEntries([]);
  }, []);

  const findById = useCallback(
    (id: string): HistoryEntry | null => {
      const fromState = entries.find((e) => e.id === id);
      if (fromState) return fromState;
      // Direct read so routes that hydrate synchronously (URL ?restore=...)
      // don't need to wait for `hydrated` to flip.
      return read().find((e) => e.id === id) ?? null;
    },
    [entries],
  );

  return { entries, hydrated, add, remove, clear, findById };
}

// Non-hook synchronous lookup for code paths that can't call hooks (e.g.
// URL-sync effects that need the entry BEFORE rendering). Reads localStorage
// directly; safe to call from client-side useEffect.
export function getHistoryEntry(id: string): HistoryEntry | null {
  return read().find((e) => e.id === id) ?? null;
}
