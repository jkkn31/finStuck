// /portfolio — "My stocks" tab. Lists the user's holdings, fetches current
// quotes to show day-change and P&L, and on demand runs the Portfolio
// agent to surface a one-line performance summary + top headlines per
// stock.
//
// All holdings live in localStorage — no backend, no account. Quotes
// fetched on mount and whenever the holdings list changes.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AddHoldingForm from "@/components/AddHoldingForm";
import PortfolioTable from "@/components/PortfolioTable";
import PortfolioSummaryPanel from "@/components/PortfolioSummaryPanel";
import { usePortfolio } from "@/hooks/usePortfolio";
import type { Quote } from "@/lib/tools/yahoo";
import type { PortfolioInsights } from "@/lib/schemas";

type QuoteMap = Record<string, Quote | null>;

type SummaryStage = "fetching" | "thinking" | null;

export default function PortfolioPage() {
  const { holdings, hydrated, add, update, remove } = usePortfolio();
  // Which row is being edited inline. null = none.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<QuoteMap>({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);

  // Agent state
  const [summary, setSummary] = useState<PortfolioInsights | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryStage, setSummaryStage] = useState<SummaryStage>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const summaryAbortRef = useRef<AbortController | null>(null);

  // Fetch quotes whenever the ticker set changes. De-dup so a user with
  // two lots of the same ticker (e.g. different cost bases) only pulls
  // the quote once.
  const tickerList = useMemo(() => {
    return [...new Set(holdings.map((h) => h.ticker.toUpperCase()))];
  }, [holdings]);

  useEffect(() => {
    if (!hydrated) return;
    if (tickerList.length === 0) {
      setQuotes({});
      return;
    }
    let cancelled = false;
    setLoadingQuotes(true);
    setQuotesError(null);
    fetch(`/api/quotes?t=${tickerList.map(encodeURIComponent).join(",")}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "fetch failed");
        return json.data as Array<{ ticker: string; ok: boolean; quote?: Quote; error?: string }>;
      })
      .then((rows) => {
        if (cancelled) return;
        const map: QuoteMap = {};
        for (const row of rows) {
          map[row.ticker] = row.ok && row.quote ? row.quote : null;
        }
        setQuotes(map);
      })
      .catch((err: unknown) => {
        if (!cancelled) setQuotesError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoadingQuotes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, tickerList]);

  const onAdd = useCallback(
    (h: { ticker: string; shares: number; costBasis?: number; notes?: string }) => {
      add(h);
      setSummary(null); // invalidate prior agent output when holdings change
    },
    [add],
  );

  const onStartEdit = useCallback((id: string) => {
    setEditingId(id);
  }, []);

  const onCancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const onSaveEdit = useCallback(
    (id: string, patch: { shares: number; costBasis?: number; notes?: string }) => {
      update(id, patch);
      setEditingId(null);
      setSummary(null);
    },
    [update],
  );

  const onRemove = useCallback(
    (id: string) => {
      remove(id);
      setSummary(null);
    },
    [remove],
  );

  const runSummary = useCallback(async () => {
    if (tickerList.length === 0) return;
    summaryAbortRef.current?.abort();
    const ctrl = new AbortController();
    summaryAbortRef.current = ctrl;

    setSummaryLoading(true);
    setSummaryStage(null);
    setSummaryError(null);
    setSummary(null);

    try {
      const res = await fetch("/api/portfolio/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: tickerList }),
        signal: ctrl.signal,
      });
      if (!res.body) throw new Error("no stream body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const ev = parseSSE(raw);
          if (!ev) continue;
          if (ev.event === "progress") {
            const stage = (ev.data as { stage?: SummaryStage }).stage ?? null;
            setSummaryStage(stage);
          } else if (ev.event === "result") {
            setSummary((ev.data as { insights: PortfolioInsights }).insights);
          } else if (ev.event === "error") {
            setSummaryError((ev.data as { message?: string }).message ?? "unknown error");
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setSummaryError((err as Error).message);
      }
    } finally {
      setSummaryLoading(false);
      setSummaryStage(null);
    }
  }, [tickerList]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My stocks</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Track what you own and get a one-click daily briefing. Everything
            stays on this browser — no broker connection, no account.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={runSummary}
            disabled={summaryLoading || tickerList.length === 0}
            className="rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white px-3 py-1.5 text-xs font-medium"
          >
            {summaryLoading ? "Summarizing…" : "Summarize my portfolio"}
          </button>
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline underline-offset-2"
          >
            ← back to dashboard
          </Link>
        </div>
      </header>

      {quotesError && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-3 text-sm text-rose-800 dark:text-rose-200">
          Couldn&apos;t fetch live quotes: {quotesError}
        </div>
      )}

      <AddHoldingForm onSubmit={onAdd} />

      {!hydrated ? (
        <div className="text-sm text-zinc-500">Loading your portfolio…</div>
      ) : (
        <PortfolioTable
          holdings={holdings}
          quotes={quotes}
          loadingQuotes={loadingQuotes}
          editingId={editingId}
          onStartEdit={onStartEdit}
          onSaveEdit={onSaveEdit}
          onCancelEdit={onCancelEdit}
          onRemove={onRemove}
        />
      )}

      {(summary || summaryLoading || summaryError) && (
        <PortfolioSummaryPanel
          insights={summary}
          loading={summaryLoading}
          stage={summaryStage}
          error={summaryError}
        />
      )}

      <p className="text-[11px] text-zinc-500">
        Educational tool only. Day change uses Yahoo Finance quotes (delayed
        up to 15 min outside US market hours). P&amp;L is based on the cost
        basis you enter — dividends, taxes, and fees are NOT included.
      </p>
    </div>
  );
}

function parseSSE(raw: string): { event: string; data: unknown } | null {
  const lines = raw.split("\n");
  let event = "message";
  const dataParts: string[] = [];
  for (const l of lines) {
    if (l.startsWith("event:")) event = l.slice(6).trim();
    else if (l.startsWith("data:")) dataParts.push(l.slice(5).trim());
  }
  if (dataParts.length === 0) return null;
  try {
    return { event, data: JSON.parse(dataParts.join("\n")) };
  } catch {
    return null;
  }
}
