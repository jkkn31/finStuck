// Displays the Portfolio agent's output — one card per holding with a
// single-sentence "why it moved today" and 2-3 relevant headlines.
// The page handles the SSE stream; this component just renders whatever
// `insights` it's handed.

"use client";

import type { PortfolioInsights } from "@/lib/schemas";

type Props = {
  insights: PortfolioInsights | null;
  loading: boolean;
  stage: "fetching" | "thinking" | null;
  error: string | null;
};

export default function PortfolioSummaryPanel({ insights, loading, stage, error }: Props) {
  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-4 text-sm text-rose-800 dark:text-rose-200">
        Summary failed: {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 text-sm text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-2">
          <Spinner />
          {stage === "fetching" && <span>Gathering today&apos;s quotes and headlines…</span>}
          {stage === "thinking" && <span>Analyzing your holdings…</span>}
          {!stage && <span>Working…</span>}
        </div>
      </div>
    );
  }

  if (!insights) return null;

  if (insights.stocks.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 text-sm text-zinc-500 text-center">
        No summary yet.
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <h3 className="text-sm font-semibold mb-3">Today&apos;s briefing</h3>
      <ul className="space-y-4">
        {insights.stocks.map((s) => (
          <li key={s.ticker} className="border-b border-zinc-100 dark:border-zinc-800 last:border-none pb-4 last:pb-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-semibold text-sm">{s.ticker}</span>
            </div>
            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
              {s.performance}
            </p>
            {s.headlines.length > 0 && (
              <ul className="mt-2 space-y-1">
                {s.headlines.map((h, i) => (
                  <li key={i} className="text-[12px]">
                    <a
                      href={h.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-700 dark:text-zinc-300 hover:underline"
                    >
                      {h.title}
                    </a>
                    <span className="text-zinc-500"> — {h.publisher}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] text-zinc-500">
        Educational summary only. Not financial advice. Headlines are
        selected from recent Yahoo Finance news for each ticker.
      </p>
    </section>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block w-4 h-4 rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-emerald-600 animate-spin"
      aria-hidden
    />
  );
}
