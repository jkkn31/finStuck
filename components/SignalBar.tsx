// Segmented horizontal bar showing the orchestrator's 3-way distribution
// across Buy / Hold / Sell. Rendered right under the chart on both the
// dashboard card and the /stock/[ticker] detail page.

import type { OrchestratorOutput } from "@/lib/schemas";

type Props = {
  signal: OrchestratorOutput;
};

export default function SignalBar({ signal }: Props) {
  const { buyScore, holdScore, sellScore, signal: label, confidence } = signal;
  const confidencePct = Math.round(confidence * 100);

  // Handle rounding edge cases: widths still need to add to ~100%, but a
  // rounding error of 1-2% is imperceptible at 3-segment resolution.
  const total = Math.max(buyScore + holdScore + sellScore, 1);
  const buyW = (buyScore / total) * 100;
  const holdW = (holdScore / total) * 100;
  const sellW = (sellScore / total) * 100;

  return (
    <div className="mt-4 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div className="text-[11px] uppercase tracking-wide text-zinc-500">Market lean</div>
        <div className="text-xs font-medium">
          <span className={signalColor(label)}>{label}</span>
          <span className="text-zinc-500"> · {confidencePct}% confidence</span>
        </div>
      </div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={`Buy ${buyScore}%, Hold ${holdScore}%, Sell ${sellScore}%`}
      >
        <div className="bg-emerald-500 transition-[width]" style={{ width: `${buyW}%` }} />
        <div className="bg-zinc-300 dark:bg-zinc-600 transition-[width]" style={{ width: `${holdW}%` }} />
        <div className="bg-rose-500 transition-[width]" style={{ width: `${sellW}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs font-medium">
        <span className="text-emerald-600 dark:text-emerald-400">Buy {buyScore}%</span>
        <span className="text-zinc-500">Hold {holdScore}%</span>
        <span className="text-rose-600 dark:text-rose-400">Sell {sellScore}%</span>
      </div>
    </div>
  );
}

function signalColor(signal: OrchestratorOutput["signal"]): string {
  switch (signal) {
    case "Strong Buy":
    case "Buy":
      return "text-emerald-600 dark:text-emerald-400";
    case "Sell":
    case "Strong Sell":
      return "text-rose-600 dark:text-rose-400";
    default:
      return "text-zinc-700 dark:text-zinc-300";
  }
}
