// localStorage-backed "decision journal". Saves the user's thesis at the
// moment they look at a stock so we can show it back to them months later
// alongside what actually happened. Purely client-side — no backend, no
// sync, no account. Same hydration pattern as useRecentTickers.

"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "invest.journal.v1";

export type JournalIntent = "buy" | "watch" | "skip";
export type JournalSignal =
  | "Strong Buy"
  | "Buy"
  | "Hold"
  | "Sell"
  | "Strong Sell";

export type JournalEntry = {
  id: string;
  ticker: string;
  savedAt: number; // ms epoch
  intent: JournalIntent;
  thesis: string;
  // "what would change your mind" — free text. Optional so the form isn't a
  // chore; encouraged in the UI copy.
  invalidation?: string;
  reconsiderAt: number; // ms epoch
  snapshot: {
    price: number;
    signal: JournalSignal;
    confidence: number; // 0-1
    pe: number | null;
    fwdPe: number | null;
  };
};

function read(): JournalEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Loose validation — drop entries that don't look right rather than
    // throwing. Storage from older versions shouldn't crash the UI.
    return parsed.filter(
      (e): e is JournalEntry =>
        e &&
        typeof e.id === "string" &&
        typeof e.ticker === "string" &&
        typeof e.savedAt === "number" &&
        typeof e.reconsiderAt === "number" &&
        e.snapshot &&
        typeof e.snapshot.price === "number",
    );
  } catch {
    return [];
  }
}

function write(entries: JournalEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Quota / private-mode — not critical.
  }
}

function makeId(): string {
  // Good-enough unique id without pulling in a uuid dep.
  return `j_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useDecisionJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setEntries(read());
    setHydrated(true);
  }, []);

  const add = useCallback(
    (entry: Omit<JournalEntry, "id" | "savedAt">) => {
      const full: JournalEntry = {
        ...entry,
        id: makeId(),
        savedAt: Date.now(),
      };
      setEntries((prev) => {
        const next = [full, ...prev];
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

  // Entries whose reconsiderAt date has arrived. Used for the home banner.
  const dueForReview = entries.filter((e) => e.reconsiderAt <= Date.now());

  // Latest entry for a given ticker — the card uses this to show the
  // "already saved" collapsed state.
  const latestFor = useCallback(
    (ticker: string) =>
      entries.find((e) => e.ticker.toUpperCase() === ticker.toUpperCase()) ?? null,
    [entries],
  );

  return { entries, hydrated, add, remove, clear, dueForReview, latestFor };
}
