// Chip bar showing recently-analyzed tickers. Clicking a chip fires onPick
// so the dashboard can immediately re-analyze. Hover reveals an × to remove
// a single chip; a tiny "clear all" button sits at the end.

"use client";

type Props = {
  recent: string[];
  onPick: (ticker: string) => void;
  onRemove: (ticker: string) => void;
  onClear: () => void;
};

export default function RecentTickersBar({ recent, onPick, onRemove, onClear }: Props) {
  if (recent.length === 0) return null;

  return (
    <div className="flex items-center flex-wrap gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-zinc-500 mr-1">Recent:</span>
      {recent.map((t) => (
        <span
          key={t}
          className="group inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs font-mono px-2.5 py-0.5 transition-colors"
        >
          <button
            type="button"
            onClick={() => onPick(t)}
            className="outline-none focus:text-emerald-600"
            aria-label={`Re-analyze ${t}`}
          >
            {t}
          </button>
          <button
            type="button"
            onClick={() => onRemove(t)}
            aria-label={`Remove ${t} from recents`}
            className="text-zinc-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity w-3 h-3 leading-none text-[10px]"
          >
            ×
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline-offset-2 hover:underline ml-1"
      >
        clear
      </button>
    </div>
  );
}
