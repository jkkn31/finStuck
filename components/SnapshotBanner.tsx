// "Viewing snapshot" banner shown on the dashboard when the user opened a
// past analysis from /history. Communicates that prices and indicators are
// frozen to the save time, and offers a one-click "refresh" that clears the
// banner and re-runs the analysis against today's data.

"use client";

type Props = {
  savedAt: number;
  tickers: string[];
  onRefresh: () => void;
};

function formatWhen(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SnapshotBanner({ savedAt, tickers, onRefresh }: Props) {
  return (
    <div className="rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/30 px-4 py-3 text-sm text-sky-900 dark:text-sky-200 flex items-start justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <span className="font-semibold">Viewing a saved snapshot.</span>{" "}
        Analysis of{" "}
        <span className="font-mono">{tickers.join(", ")}</span>{" "}
        from <span className="font-mono">{formatWhen(savedAt)}</span>. Prices
        and indicators are frozen to that moment.
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="shrink-0 rounded-md border border-sky-300 dark:border-sky-700 px-3 py-1 text-xs font-medium text-sky-800 dark:text-sky-200 hover:bg-sky-100 dark:hover:bg-sky-900/40"
      >
        Refresh with today&apos;s data →
      </button>
    </div>
  );
}
