// Pill for the orchestrator's coarse signal. Strong Buy / Strong Sell get a
// subtle gradient + pulsing dot to read like "high-conviction" flags without
// being cartoonish. Hold / Buy / Sell stay flatter.

import clsx from "clsx";

const STYLES: Record<string, { bg: string; dot?: boolean }> = {
  "Strong Buy": {
    bg: "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm",
    dot: true,
  },
  Buy: { bg: "bg-emerald-500 text-white" },
  Hold: { bg: "bg-zinc-400 dark:bg-zinc-500 text-white" },
  Sell: { bg: "bg-rose-500 text-white" },
  "Strong Sell": {
    bg: "bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-sm",
    dot: true,
  },
};

export default function SignalBadge({
  signal,
  confidence,
}: {
  signal: string;
  confidence?: number;
}) {
  const { bg, dot } = STYLES[signal] ?? { bg: "bg-zinc-500 text-white" };
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
        bg,
      )}
    >
      {dot && (
        <span className="relative inline-flex w-1.5 h-1.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-70 animate-ping" />
          <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-white" />
        </span>
      )}
      {signal}
      {confidence != null && (
        <span className="opacity-80 font-normal">· {Math.round(confidence * 100)}% confidence</span>
      )}
    </span>
  );
}
