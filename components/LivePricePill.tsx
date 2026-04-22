// Status pill shown in the card header. Indicates whether the displayed price
// is a fresh WebSocket tick, an older fetched quote, or the delayed Yahoo
// snapshot from when the analysis ran.

import clsx from "clsx";
import type { LiveStatus } from "@/hooks/useLivePrices";

type Props = {
  status: LiveStatus;
  hasRecentTick: boolean; // true if we've received at least one trade for this symbol
  ageSec?: number; // seconds since last tick for this symbol
};

export default function LivePricePill({ status, hasRecentTick, ageSec }: Props) {
  if (status === "disabled") {
    return (
      <span
        title="No NEXT_PUBLIC_FINNHUB_API_KEY configured — showing Yahoo delayed price"
        className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
        Delayed
      </span>
    );
  }

  if (status === "connected" && hasRecentTick) {
    const ageLabel = ageSec != null ? (ageSec < 60 ? `${ageSec}s` : `${Math.floor(ageSec / 60)}m`) : "";
    return (
      <span
        title="Real-time price via Finnhub"
        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300"
      >
        <span className="relative inline-flex w-1.5 h-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
          <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </span>
        Live {ageLabel && <span className="opacity-70">· {ageLabel}</span>}
      </span>
    );
  }

  return (
    <span
      title={
        status === "connecting"
          ? "Connecting to Finnhub…"
          : status === "disconnected"
          ? "Disconnected — will reconnect automatically"
          : "Waiting for first tick (market may be closed)"
      }
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]",
        "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900",
        "text-amber-700 dark:text-amber-300",
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      {status === "connected" ? "Waiting for tick" : status === "connecting" ? "Connecting" : "Reconnecting"}
    </span>
  );
}
