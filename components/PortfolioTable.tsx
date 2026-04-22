// Portfolio holdings table. Per-row: ticker, name, shares, cost basis,
// current price, day change, position value, unrealized P&L. Footer row
// totals up portfolio value and day change in dollars.
//
// Clicking Edit swaps the row into an inline-edit state: shares and
// cost-basis cells become inputs, Edit / Remove become Save / Cancel.
// Ticker is intentionally NOT editable inline — changing it means it's a
// different holding entirely, and we want the delete-and-re-add flow to
// be explicit.
//
// Quotes are passed in (fetched by the page via /api/quotes) so this
// component is presentational only — easy to test, easy to reuse.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Quote } from "@/lib/tools/yahoo";
import type { Holding } from "@/hooks/usePortfolio";

type Props = {
  holdings: Holding[];
  quotes: Record<string, Quote | null>;
  loadingQuotes: boolean;
  editingId: string | null;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, patch: { shares: number; costBasis?: number; notes?: string }) => void;
  onRemove: (id: string) => void;
};

export default function PortfolioTable({
  holdings,
  quotes,
  loadingQuotes,
  editingId,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRemove,
}: Props) {
  // Per-row compute. A quote might not have resolved yet (loading) or may
  // have errored (unknown ticker) — in both cases we render dashes.
  const rows = holdings.map((h) => {
    const quote = quotes[h.ticker];
    const price = quote?.price ?? null;
    const dayChangePct = quote?.changePercent ?? null;
    const prevClose = quote?.previousClose ?? null;
    const dayChangeDollar =
      price != null && prevClose != null ? (price - prevClose) * h.shares : null;
    const value = price != null ? price * h.shares : null;
    const pnlDollar =
      price != null && h.costBasis != null ? (price - h.costBasis) * h.shares : null;
    const pnlPct =
      price != null && h.costBasis != null && h.costBasis > 0
        ? (price / h.costBasis - 1) * 100
        : null;
    return { h, quote, price, dayChangePct, dayChangeDollar, value, pnlDollar, pnlPct };
  });

  // Totals footer — only add up rows we have data for. Portfolio total
  // value is the sum of resolved positions; day change $ is the sum of
  // resolved day-change dollars.
  const totalValue = rows.reduce((s, r) => s + (r.value ?? 0), 0);
  const totalDayChange = rows.reduce((s, r) => s + (r.dayChangeDollar ?? 0), 0);
  const totalPnl = rows.reduce((s, r) => s + (r.pnlDollar ?? 0), 0);
  const resolvedCount = rows.filter((r) => r.value != null).length;

  if (holdings.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-sm text-zinc-500">
        No holdings yet. Add one above to get started.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-950/50 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2 text-left">Ticker</th>
              <th className="px-3 py-2 text-right">Shares</th>
              <th className="px-3 py-2 text-right hidden sm:table-cell">Cost basis</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-right">Day change</th>
              <th className="px-3 py-2 text-right">Value</th>
              <th className="px-3 py-2 text-right hidden md:table-cell">P&amp;L</th>
              <th className="px-3 py-2 text-right" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) =>
              editingId === r.h.id ? (
                <EditableRow
                  key={r.h.id}
                  holding={r.h}
                  onSave={(patch) => onSaveEdit(r.h.id, patch)}
                  onCancel={onCancelEdit}
                />
              ) : (
                <tr
                  key={r.h.id}
                  className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/?t=${encodeURIComponent(r.h.ticker)}`}
                      className="font-mono font-semibold hover:underline"
                    >
                      {r.h.ticker}
                    </Link>
                    <div className="text-[10px] text-zinc-500 truncate max-w-[220px]">
                      {r.quote?.name ?? ""}
                      {r.h.notes && <span className="ml-1 text-zinc-400">· {r.h.notes}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {formatShares(r.h.shares)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs hidden sm:table-cell">
                    {r.h.costBasis != null ? `$${r.h.costBasis.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {r.price != null ? `$${r.price.toFixed(2)}` : loadingQuotes ? "…" : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className={"font-mono text-xs " + moveClass(r.dayChangePct)}>
                      {r.dayChangePct != null
                        ? `${r.dayChangePct >= 0 ? "+" : ""}${r.dayChangePct.toFixed(2)}%`
                        : loadingQuotes
                        ? "…"
                        : "—"}
                    </div>
                    <div className={"font-mono text-[10px] " + moveClass(r.dayChangeDollar)}>
                      {r.dayChangeDollar != null
                        ? `${r.dayChangeDollar >= 0 ? "+" : ""}$${Math.abs(r.dayChangeDollar).toFixed(2)}`
                        : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-sm font-semibold">
                    {r.value != null ? `$${formatMoney(r.value)}` : loadingQuotes ? "…" : "—"}
                  </td>
                  <td className="px-3 py-2 text-right hidden md:table-cell">
                    {r.pnlDollar != null && r.pnlPct != null ? (
                      <>
                        <div className={"font-mono text-xs " + moveClass(r.pnlDollar)}>
                          {r.pnlDollar >= 0 ? "+" : ""}${formatMoney(Math.abs(r.pnlDollar))}
                        </div>
                        <div className={"font-mono text-[10px] " + moveClass(r.pnlPct)}>
                          {r.pnlPct >= 0 ? "+" : ""}
                          {r.pnlPct.toFixed(1)}%
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onStartEdit(r.h.id)}
                        className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                      >
                        Edit
                      </button>
                      <span className="text-zinc-300 dark:text-zinc-700">·</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Remove ${r.h.ticker} from your portfolio?`)) {
                            onRemove(r.h.id);
                          }
                        }}
                        className="text-xs text-zinc-400 hover:text-rose-600"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
          </tbody>
          {resolvedCount > 0 && (
            <tfoot className="bg-zinc-50 dark:bg-zinc-950/50">
              <tr className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500" colSpan={4}>
                  Portfolio total {resolvedCount < holdings.length && (
                    <span className="text-zinc-400 ml-1">({resolvedCount} of {holdings.length} priced)</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className={"font-mono text-sm font-semibold " + moveClass(totalDayChange)}>
                    {totalDayChange >= 0 ? "+" : ""}${formatMoney(Math.abs(totalDayChange))}
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-mono text-sm font-semibold">
                  ${formatMoney(totalValue)}
                </td>
                <td className="px-3 py-2 text-right hidden md:table-cell">
                  <div className={"font-mono text-sm font-semibold " + moveClass(totalPnl)}>
                    {totalPnl >= 0 ? "+" : ""}${formatMoney(Math.abs(totalPnl))}
                  </div>
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// Inline-edit row. Shares + cost basis + notes fields live in the same
// cells as the read-only values. Enter saves, Escape cancels. Validates
// shares > 0 and cost-basis (if set) ≥ 0 before allowing save.
function EditableRow({
  holding,
  onSave,
  onCancel,
}: {
  holding: Holding;
  onSave: (patch: { shares: number; costBasis?: number; notes?: string }) => void;
  onCancel: () => void;
}) {
  const [sharesStr, setSharesStr] = useState(String(holding.shares));
  const [costBasisStr, setCostBasisStr] = useState(
    holding.costBasis != null ? String(holding.costBasis) : "",
  );
  const [notes, setNotes] = useState(holding.notes ?? "");

  const shares = Number(sharesStr);
  const costBasis = costBasisStr.trim() ? Number(costBasisStr) : undefined;
  const canSave =
    Number.isFinite(shares) &&
    shares > 0 &&
    (costBasis == null || (Number.isFinite(costBasis) && costBasis >= 0));

  function save() {
    if (!canSave) return;
    onSave({ shares, costBasis, notes: notes.trim() || undefined });
  }

  // Escape cancels from anywhere within the row.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const inputCls =
    "w-full rounded border border-emerald-400 dark:border-emerald-700 bg-white dark:bg-zinc-900 px-1.5 py-0.5 text-xs text-right font-mono outline-none focus:border-emerald-600";

  return (
    <tr className="border-t border-emerald-200 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/20">
      <td className="px-3 py-2">
        <div className="font-mono font-semibold">{holding.ticker}</div>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder='notes (optional, e.g. "IRA")'
          maxLength={40}
          className="mt-1 w-full max-w-[220px] rounded border border-emerald-400 dark:border-emerald-700 bg-white dark:bg-zinc-900 px-1.5 py-0.5 text-[11px] outline-none focus:border-emerald-600"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          min="0"
          step="any"
          value={sharesStr}
          onChange={(e) => setSharesStr(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className={inputCls}
          autoFocus
        />
      </td>
      <td className="px-3 py-2 text-right hidden sm:table-cell">
        <input
          type="number"
          min="0"
          step="any"
          value={costBasisStr}
          onChange={(e) => setCostBasisStr(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="(blank = no P&L)"
          className={inputCls}
        />
      </td>
      {/* Read-only cells during edit — these are derived from quote data
          that isn't user-editable. Rendering dashes keeps the grid
          visually stable while the row is in edit mode. */}
      <td className="px-3 py-2 text-right text-zinc-400 font-mono text-xs">—</td>
      <td className="px-3 py-2 text-right text-zinc-400 font-mono text-xs">—</td>
      <td className="px-3 py-2 text-right text-zinc-400 font-mono text-xs">—</td>
      <td className="px-3 py-2 text-right text-zinc-400 font-mono text-xs hidden md:table-cell">—</td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-2 py-0.5 text-xs font-medium"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-2 py-0.5 text-xs text-zinc-600 dark:text-zinc-300"
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

function moveClass(n: number | null): string {
  if (n == null || !Number.isFinite(n) || n === 0) return "text-zinc-500";
  return n > 0 ? "text-emerald-600" : "text-rose-600";
}

function formatShares(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
