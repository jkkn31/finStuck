// /history — persistent list of past analyses.
//
// Saved snapshots live in localStorage (see hooks/useAnalysisHistory). Each
// entry is a complete moment-in-time capture: tickers, signals, full
// StockAnalysis payloads. Clicking a row navigates to the dashboard with
// `?restore=<id>`, which hydrates state from the entry without spending LLM
// credits on a re-analysis.

"use client";

import Link from "next/link";
import { useAnalysisHistory, type HistoryEntry } from "@/hooks/useAnalysisHistory";

export default function HistoryPage() {
  const { entries, hydrated, remove, clear } = useAnalysisHistory();

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analysis history</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Every analysis you run is saved here so you can revisit it without
            re-spending LLM credits. Stored only in this browser. Capped at
            the 30 most recent.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline underline-offset-2"
          >
            ← back to dashboard
          </Link>
          {hydrated && entries.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Delete all saved analyses? This can't be undone.")) {
                  clear();
                }
              }}
              className="text-xs text-zinc-500 hover:text-rose-600"
            >
              Clear all
            </button>
          )}
        </div>
      </header>

      {!hydrated && (
        <div className="text-sm text-zinc-500">Loading your history…</div>
      )}

      {hydrated && entries.length === 0 && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No analyses saved yet. Analyze any ticker and it&apos;ll appear here
            automatically.
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
            <Row key={e.id} e={e} onDelete={() => remove(e.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ e, onDelete }: { e: HistoryEntry; onDelete: () => void }) {
  const when = new Date(e.savedAt).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <li className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-semibold tracking-tight">
              {e.tickers.join(" · ")}
            </h2>
            <span className="text-xs text-zinc-500">· {when}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {e.tickers.map((t) => {
              const a = e.analyses[t];
              if (!a) return null;
              return <SignalChip key={t} ticker={t} analysis={a} />;
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/?restore=${encodeURIComponent(e.id)}`}
            className="rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-3 py-1.5 text-xs font-medium"
          >
            Revisit
          </Link>
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-zinc-400 hover:text-rose-600"
            aria-label="Delete entry"
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}

function SignalChip({
  ticker,
  analysis,
}: {
  ticker: string;
  analysis: HistoryEntry["analyses"][string];
}) {
  const sig = analysis.signal.signal;
  const conf = Math.round(analysis.signal.confidence * 100);
  const color =
    sig === "Strong Buy" || sig === "Buy"
      ? "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/40"
      : sig === "Strong Sell" || sig === "Sell"
      ? "text-rose-700 bg-rose-100 dark:text-rose-300 dark:bg-rose-950/40"
      : "text-zinc-700 bg-zinc-100 dark:text-zinc-300 dark:bg-zinc-800";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      <span className="font-mono">{ticker}</span>
      <span className="text-zinc-500">·</span>
      <span>${analysis.price.toFixed(2)}</span>
      <span className="text-zinc-500">·</span>
      <span>{sig}</span>
      <span className="text-zinc-500">{conf}%</span>
    </span>
  );
}
