// localStorage-backed portfolio of the user's stock holdings. Follows the
// same hydration pattern as useDecisionJournal / useAnalysisHistory — empty
// list on SSR and first render, then hydrates once mounted.
//
// Cost basis is optional: some users remember what they paid (good — lets
// us show unrealized P&L), others don't (that's fine, we just show today's
// value without gain/loss).

"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "invest.portfolio.v1";

export type Holding = {
  id: string;
  ticker: string;
  shares: number;
  costBasis?: number; // avg $/share at purchase
  addedAt: number;    // ms epoch
  notes?: string;     // optional user note, e.g. "IRA", "401k rollover"
};

// Strip anything that isn't a valid ticker character. Yahoo symbols are
// letters + digits + dot (e.g. BRK.B) + dash (e.g. BRK-B). Users trained
// by the landing-page input sometimes trail a comma after a ticker ("PLTR,")
// — without this sanitizer that comma would persist in localStorage and
// break every downstream Yahoo lookup.
function sanitizeTicker(t: string): string {
  return t.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
}

function read(): Holding[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Migrate: strip any stray non-ticker chars (comma etc.) from stored
    // entries. Also drops any row whose ticker becomes empty after
    // cleaning, since that's junk data we can't recover.
    return parsed
      .filter(
        (e): e is Holding =>
          e &&
          typeof e.id === "string" &&
          typeof e.ticker === "string" &&
          typeof e.shares === "number" &&
          typeof e.addedAt === "number",
      )
      .map((e) => ({ ...e, ticker: sanitizeTicker(e.ticker) }))
      .filter((e) => e.ticker.length > 0);
  } catch {
    return [];
  }
}

function write(entries: Holding[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // quota / private mode — not critical
  }
}

function makeId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function usePortfolio() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHoldings(read());
    setHydrated(true);
  }, []);

  const add = useCallback((h: Omit<Holding, "id" | "addedAt">) => {
    const full: Holding = {
      ...h,
      ticker: sanitizeTicker(h.ticker),
      id: makeId(),
      addedAt: Date.now(),
    };
    setHoldings((prev) => {
      const next = [full, ...prev];
      write(next);
      return next;
    });
    return full;
  }, []);

  const update = useCallback((id: string, patch: Partial<Omit<Holding, "id" | "addedAt">>) => {
    setHoldings((prev) => {
      const next = prev.map((h) =>
        h.id === id
          ? {
              ...h,
              ...patch,
              ticker: patch.ticker ? sanitizeTicker(patch.ticker) : h.ticker,
            }
          : h,
      );
      write(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setHoldings((prev) => {
      const next = prev.filter((h) => h.id !== id);
      write(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    write([]);
    setHoldings([]);
  }, []);

  return { holdings, hydrated, add, update, remove, clear };
}
