// Reusable 7-item pre-buy checklist section. Shared between the dashboard
// DetailedStockCard and the /stock/[ticker] detail page so both stay in sync.

import type { ChecklistFinding } from "@/lib/schemas";

export default function ChecklistSection({ checklist }: { checklist: ChecklistFinding }) {
  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-sm">Pre-buy checklist</h3>
        <div className="text-xs text-zinc-500">
          {checklist.passCount}/{checklist.items.length} passed · {checklist.warnCount} warn · {checklist.failCount} fail
          <span className="mx-2">·</span>
          inspired by{" "}
          <a
            href="https://www.heygotrade.com/en/blog/checklist-before-buying-a-stock"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-emerald-600"
          >
            HeyGoTrade&apos;s 10-item guide
          </a>
        </div>
      </div>
      <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{checklist.summary}</p>
      <ul className="mt-3 grid sm:grid-cols-2 gap-2">
        {checklist.items.map((item) => (
          <li
            key={item.key}
            className="flex items-start gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2"
          >
            <StatusPill status={item.status} />
            <div className="min-w-0">
              <div className="text-sm font-medium">{item.label}</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">{item.finding}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusPill({ status }: { status: "pass" | "warn" | "fail" | "n/a" }) {
  const map = {
    pass: { text: "PASS", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
    warn: { text: "WARN", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
    fail: { text: "FAIL", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" },
    "n/a": { text: "N/A", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
  } as const;
  const { text, cls } = map[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold mt-0.5 w-11 ${cls}`}
    >
      {text}
    </span>
  );
}
