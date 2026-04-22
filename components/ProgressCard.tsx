// Progress card shown while a ticker is being analyzed. Three visible layers:
//
//   1. A single animated progress bar (hybrid: real SSE progress OR time-based
//      fallback, whichever is further along). Keeps moving forward even when
//      Vercel's gateway buffers SSE events.
//   2. A 6-step emoji row underneath, mapping each stage to its status:
//      pending (faded), running (pulsing), done (check), error (red).
//   3. A rotating stock-market aphorism below — different quote every 5 s,
//      no consecutive repeats. Gives the user something to read while
//      agents work.

"use client";

import { useEffect, useState } from "react";

export type StageStatus = "pending" | "running" | "done" | "error";
export type StageState = {
  status: StageStatus;
  substep?: string;
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
};

export type ProgressState = {
  quote: StageState;
  fundamentals: StageState;
  technicals: StageState;
  news: StageState;
  orchestrator: StageState;
  checklist: StageState;
  error?: string;
  tickerStartedAt?: number;
};

type StageKey = keyof Omit<ProgressState, "error" | "tickerStartedAt">;

// Two labels per stage: `tooltip` is the verbose description (still used as a
// title attribute on hover), `short` is the 1-2-word name shown under the
// emoji in the compact row.
const STAGES: { key: StageKey; short: string; tooltip: string; emoji: string }[] = [
  { key: "quote", short: "Quote", tooltip: "Fetching live quote", emoji: "💵" },
  { key: "fundamentals", short: "Fundamentals", tooltip: "Analyzing fundamentals", emoji: "📊" },
  { key: "technicals", short: "Technicals", tooltip: "Analyzing technicals", emoji: "📈" },
  { key: "news", short: "News", tooltip: "Reading news & sentiment", emoji: "📰" },
  { key: "orchestrator", short: "Signal", tooltip: "Synthesizing signal", emoji: "🧠" },
  { key: "checklist", short: "Checklist", tooltip: "Running pre-buy checklist", emoji: "✅" },
];

const EXPECTED_TOTAL_MS = 18_000;

export default function ProgressCard({
  ticker,
  state,
}: {
  ticker: string;
  state: ProgressState;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const successCount = STAGES.filter((s) => state[s.key].status === "done").length;
  const errorCount = STAGES.filter((s) => state[s.key].status === "error").length;
  const anyError = errorCount > 0;

  const started = state.tickerStartedAt ?? now;
  const elapsedMs = Math.max(0, now - started);
  const elapsedSec = (elapsedMs / 1000).toFixed(1);

  // Time-based fallback runs ONLY while no error has been reported. The
  // moment an error arrives, we freeze everything at its real-server value
  // — no fake emoji lighting, no counter ticking past what actually ran,
  // no progress-bar advancement.
  const timeProgress = anyError ? 0 : Math.min(0.95, elapsedMs / EXPECTED_TOTAL_MS);

  const realProgress = successCount / STAGES.length;
  // Error state: bar visually terminates at 100% red to signal "stopped".
  // Happy path: max of real and time-based, so the bar always moves forward.
  const progress = anyError ? 1 : Math.max(realProgress, timeProgress);
  const percent = Math.round(progress * 100);

  const estimatedSteps = anyError
    ? 0
    : Math.min(STAGES.length - 1, Math.floor(timeProgress * STAGES.length));
  const shownSteps = anyError ? successCount : Math.max(successCount, estimatedSteps);

  // Pulsing ring only for actually-running stages reported via SSE — never
  // auto-lit by time estimate after an error.
  const runningKey = STAGES.find((s) => state[s.key].status === "running")?.key ?? null;

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-lg">{ticker}</div>
        <div className="text-xs text-zinc-500 font-mono">
          {anyError ? (
            <span className="text-rose-600">issue while analyzing</span>
          ) : (
            <>Analyzing… {elapsedSec}s</>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className={
            anyError
              ? "h-full bg-rose-500 transition-[width] duration-300 ease-out"
              : "h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-[width] duration-500 ease-out"
          }
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Step-emoji row — each emoji becomes vivid as its stage completes.
          After an error, we freeze and show only REAL server status — no
          time-based auto-lighting of stages that never actually ran. */}
      <div className="mt-4 flex items-center justify-between">
        {STAGES.map((s, idx) => {
          const st = state[s.key].status;
          const isRunning = runningKey === s.key;
          const estimatedActive = !anyError && idx < estimatedSteps;
          const effectiveStatus: StageStatus =
            st === "pending" && estimatedActive ? "running" : st;
          return (
            <StageEmoji
              key={s.key}
              emoji={s.emoji}
              short={s.short}
              tooltip={s.tooltip}
              status={effectiveStatus}
              pulsing={isRunning}
            />
          );
        })}
      </div>

      {/* Counter row */}
      <div className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
        {anyError ? (
          <span className="text-rose-700 dark:text-rose-300">
            Stopped after{" "}
            <span className="font-mono font-semibold">{successCount}</span>
            <span className="text-rose-600/80 dark:text-rose-400/80">
              {" "}
              of {STAGES.length} steps
            </span>
          </span>
        ) : (
          <>
            <span className="font-mono font-semibold">{shownSteps}</span>
            <span className="text-zinc-500"> of {STAGES.length} steps complete</span>
          </>
        )}
      </div>

      {/* Rotating quote */}
      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
        <QuoteRotator />
      </div>

      {/* No inline error text here — the outer TickerDashboard panel surfaces
          the friendly message once, so we don't duplicate it on the card. */}
    </div>
  );
}

function StageEmoji({
  emoji,
  short,
  tooltip,
  status,
  pulsing,
}: {
  emoji: string;
  short: string;
  tooltip: string;
  status: StageStatus;
  pulsing: boolean;
}) {
  // Visual encoding:
  //   pending → faded + grayscale
  //   running → full color + subtle pulsing ring (only when SSE confirms)
  //   done    → full color + solid ring
  //   error   → full color + red ring
  const bgClass =
    status === "done"
      ? "bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-300 dark:ring-emerald-800"
      : status === "error"
      ? "bg-rose-50 dark:bg-rose-950/40 ring-1 ring-rose-400"
      : status === "running"
      ? "bg-emerald-50/60 dark:bg-emerald-950/30 ring-1 ring-emerald-200 dark:ring-emerald-900"
      : "bg-zinc-50 dark:bg-zinc-800/60";

  const emojiClass = status === "pending" ? "opacity-40 grayscale" : "opacity-100";

  const labelClass =
    status === "done" || status === "running"
      ? "text-emerald-700 dark:text-emerald-300 font-medium"
      : status === "error"
      ? "text-rose-600 dark:text-rose-400 font-medium"
      : "text-zinc-400 dark:text-zinc-500";

  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0" title={tooltip}>
      <div
        className={`relative flex items-center justify-center w-10 h-10 rounded-full ${bgClass}`}
      >
        {pulsing && status === "running" && (
          <span className="absolute inset-0 rounded-full ring-2 ring-emerald-400 animate-ping opacity-50" />
        )}
        <span className={`text-lg ${emojiClass}`}>{emoji}</span>
      </div>
      <span className={`text-[10px] whitespace-nowrap ${labelClass}`}>{short}</span>
    </div>
  );
}

// ─── Rotating quote ──────────────────────────────────────────────────────────

// 20 stock-market aphorisms. Intentionally broad mix — beginner-friendly plus
// some classic Wall Street sayings. Kept short so they fit on one line.
const QUOTES: string[] = [
  "Time in the market beats timing the market.",
  "Buy the dip. Sell the rip.",
  "Don't panic sell.",
  "Be fearful when others are greedy, and greedy when others are fearful.",
  "The stock market transfers money from the impatient to the patient.",
  "Bulls make money, bears make money, pigs get slaughtered.",
  "Cut your losses short and let your winners run.",
  "The trend is your friend — until it bends.",
  "Plan the trade, trade the plan.",
  "Risk comes from not knowing what you're doing.",
  "Never fall in love with a stock.",
  "The four most dangerous words: 'this time it's different.'",
  "Know what you own, and know why you own it.",
  "Diversification is the only free lunch in investing.",
  "The market can stay irrational longer than you can stay solvent.",
  "Price is what you pay. Value is what you get.",
  "In investing, what is comfortable is rarely profitable.",
  "Invest in yourself — it's the best asset you'll ever own.",
  "Don't put all your eggs in one basket.",
  "Compound interest is the eighth wonder of the world.",
];

function QuoteRotator() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * QUOTES.length));

  useEffect(() => {
    const id = setInterval(() => {
      setIdx((prev) => {
        // Pick any other quote than the current one (no back-to-back repeats).
        if (QUOTES.length <= 1) return prev;
        let next = Math.floor(Math.random() * QUOTES.length);
        if (next === prev) next = (next + 1) % QUOTES.length;
        return next;
      });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="text-sm text-zinc-700 dark:text-zinc-300 italic flex items-start gap-2 leading-relaxed">
      <span aria-hidden className="text-base">💭</span>
      <span key={idx} className="animate-fade-in">&ldquo;{QUOTES[idx]}&rdquo;</span>
    </div>
  );
}
