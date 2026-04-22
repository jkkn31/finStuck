// Compact inline form to add or edit a portfolio holding. Ticker is
// required; shares is required; cost basis is optional (shown but the
// user can leave it blank and we'll just skip P&L for that row).
//
// Reuses TickerAutocomplete so the user gets the same S&P 500 typeahead
// as the main dashboard. That keeps input consistent and reduces
// fat-fingered tickers.

"use client";

import { useState } from "react";
import TickerAutocomplete from "./TickerAutocomplete";
import type { Holding } from "@/hooks/usePortfolio";

type Props = {
  initial?: Holding;
  onSubmit: (h: { ticker: string; shares: number; costBasis?: number; notes?: string }) => void;
  onCancel?: () => void;
  submitLabel?: string;
};

export default function AddHoldingForm({ initial, onSubmit, onCancel, submitLabel = "Add holding" }: Props) {
  const [ticker, setTicker] = useState(initial?.ticker ?? "");
  const [sharesStr, setSharesStr] = useState(initial?.shares?.toString() ?? "");
  const [costBasisStr, setCostBasisStr] = useState(
    initial?.costBasis != null ? initial.costBasis.toString() : "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const shares = Number(sharesStr);
  const costBasis = costBasisStr.trim() ? Number(costBasisStr) : undefined;
  // Strip anything that isn't a valid Yahoo ticker char (letters, digits,
  // dot for BRK.B, dash for BRK-B). Catches users trained by the landing-
  // page input to comma-separate tickers — a trailing "PLTR," would
  // otherwise persist all the way to localStorage and break quote lookups.
  const cleanTicker = ticker.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
  const canSubmit =
    cleanTicker.length > 0 &&
    Number.isFinite(shares) &&
    shares > 0 &&
    (costBasis == null || (Number.isFinite(costBasis) && costBasis > 0));

  function submit() {
    if (!canSubmit) return;
    onSubmit({
      ticker: cleanTicker,
      shares,
      costBasis,
      notes: notes.trim() || undefined,
    });
    if (!initial) {
      // reset for the next add
      setTicker("");
      setSharesStr("");
      setCostBasisStr("");
      setNotes("");
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <h3 className="text-sm font-semibold mb-3">
        {initial ? "Edit holding" : "Add a holding"}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <Field label="Ticker">
          <TickerAutocomplete
            value={ticker}
            onChange={setTicker}
            onSubmit={submit}
            placeholder="e.g. AAPL"
            className="w-full"
          />
        </Field>
        <Field label="Shares">
          <input
            type="number"
            min="0"
            step="any"
            value={sharesStr}
            onChange={(e) => setSharesStr(e.target.value)}
            placeholder="e.g. 10"
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-sm"
          />
        </Field>
        <Field label="Cost basis ($/share)" hint="optional — for P&L">
          <input
            type="number"
            min="0"
            step="any"
            value={costBasisStr}
            onChange={(e) => setCostBasisStr(e.target.value)}
            placeholder="e.g. 175.50"
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-sm"
          />
        </Field>
        <Field label="Notes" hint="optional">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder='e.g. "IRA"'
            maxLength={40}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-sm"
          />
        </Field>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-40 text-white px-3 py-1.5 text-xs font-medium"
          >
            {submitLabel}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">
        Saved only in this browser. Nothing leaves your device.
      </p>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
        {label}
        {hint && <span className="ml-1 normal-case tracking-normal text-zinc-400">· {hint}</span>}
      </div>
      {children}
    </label>
  );
}
