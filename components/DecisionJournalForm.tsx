// "Own your decision" — inline form at the bottom of a stock analysis card.
// Captures the user's thesis, what would change their mind, and when to
// re-check. Collapses to a saved-state once written. History view lives at
// /decisions.
//
// No backend; uses useDecisionJournal (localStorage). Safe to mount
// anywhere — hydration-aware and idempotent.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { StockAnalysis } from "@/lib/schemas";
import { useDecisionJournal, type JournalIntent } from "@/hooks/useDecisionJournal";

type Props = { a: StockAnalysis };

const RECHECK_OPTIONS: Array<{ label: string; days: number }> = [
  { label: "1 month", days: 30 },
  { label: "3 months", days: 90 },
  { label: "6 months", days: 182 },
];

export default function DecisionJournalForm({ a }: Props) {
  const journal = useDecisionJournal();
  const existing = journal.hydrated ? journal.latestFor(a.ticker) : null;
  const [intent, setIntent] = useState<JournalIntent>("watch");
  const [thesis, setThesis] = useState("");
  const [invalidation, setInvalidation] = useState("");
  const [recheckDays, setRecheckDays] = useState(90);
  const [justSaved, setJustSaved] = useState<string | null>(null); // id of newly added entry

  const canSave = thesis.trim().length >= 5;

  const existingDate = useMemo(() => {
    if (!existing) return null;
    return new Date(existing.savedAt).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, [existing]);

  function onSave() {
    if (!canSave) return;
    const entry = journal.add({
      ticker: a.ticker,
      intent,
      thesis: thesis.trim(),
      invalidation: invalidation.trim() || undefined,
      reconsiderAt: Date.now() + recheckDays * 24 * 3600 * 1000,
      snapshot: {
        price: a.price,
        signal: a.signal.signal,
        confidence: a.signal.confidence,
        pe: a.fundamentals.peRatio,
        fwdPe: a.fundamentals.forwardPE,
      },
    });
    setJustSaved(entry.id);
    setThesis("");
    setInvalidation("");
  }

  // Collapsed "already saved" state — shown if there's a prior entry or we
  // just saved one in this session.
  const showSaved = existing && (!justSaved || justSaved === existing.id);
  if (showSaved && existing) {
    return (
      <section
        data-tour="decision-journal"
        className="mt-6 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-4"
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">
              Your take on {a.ticker} — saved {existingDate}
            </h3>
            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
              &ldquo;{existing.thesis}&rdquo;
            </p>
            {existing.invalidation && (
              <p className="mt-1 text-xs text-zinc-500">
                Would change my mind if: {existing.invalidation}
              </p>
            )}
          </div>
          <Link
            href="/decisions"
            className="shrink-0 rounded-md border border-emerald-300 dark:border-emerald-700 px-3 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
          >
            View all decisions →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      data-tour="decision-journal"
      className="mt-6 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4"
    >
      <h3 className="font-semibold text-sm">Own your decision</h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Write down your take in one sentence. We&apos;ll show it back to you alongside
        the actual outcome so you can learn from your own calls — not ours.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Right now I am</span>
        <IntentPicker value={intent} onChange={setIntent} />
        <span className="text-zinc-600 dark:text-zinc-400">this stock.</span>
      </div>

      <label className="mt-3 block text-xs text-zinc-500">
        In one sentence, why?
      </label>
      <textarea
        value={thesis}
        onChange={(e) => setThesis(e.target.value)}
        rows={2}
        maxLength={400}
        placeholder={`e.g. "I'd buy ${a.ticker} because growth is strong and PEG is under 1.2."`}
        className="mt-1 w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-sm outline-none focus:border-emerald-500"
      />

      <label className="mt-3 block text-xs text-zinc-500">
        What would change your mind? <span className="text-zinc-400">(optional)</span>
      </label>
      <textarea
        value={invalidation}
        onChange={(e) => setInvalidation(e.target.value)}
        rows={2}
        maxLength={400}
        placeholder={`e.g. "Forward P/E going above 30 or revenue growth dropping below 10%."`}
        className="mt-1 w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-sm outline-none focus:border-emerald-500"
      />

      <div className="mt-3 flex items-center gap-2 text-sm flex-wrap">
        <span className="text-zinc-500">Re-check me in</span>
        <div className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          {RECHECK_OPTIONS.map((o) => (
            <button
              key={o.days}
              type="button"
              onClick={() => setRecheckDays(o.days)}
              className={
                "px-2 py-0.5 text-xs " +
                (recheckDays === o.days
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800")
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] text-zinc-400">
          Saved to this browser only. Nothing leaves your device.
        </p>
        <button
          type="button"
          disabled={!canSave}
          onClick={onSave}
          className="rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-40 text-white px-3 py-1.5 text-xs font-medium"
        >
          Save my take
        </button>
      </div>
    </section>
  );
}

function IntentPicker({
  value,
  onChange,
}: {
  value: JournalIntent;
  onChange: (v: JournalIntent) => void;
}) {
  const opts: Array<{ v: JournalIntent; label: string }> = [
    { v: "buy", label: "buying" },
    { v: "watch", label: "watching" },
    { v: "skip", label: "skipping" },
  ];
  return (
    <div className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={
            "px-2 py-0.5 text-xs " +
            (value === o.v
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
