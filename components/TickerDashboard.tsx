"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { StockAnalysis } from "@/lib/schemas";
import DetailedStockCard from "./DetailedStockCard";
import ProgressCard, { type ProgressState, type StageState } from "./ProgressCard";
import TickerAutocomplete from "./TickerAutocomplete";
import RecentTickersBar from "./RecentTickersBar";
import EducatorNudge from "./EducatorNudge";
import GuidedTour from "./GuidedTour";
import DecisionJournalReminder from "./DecisionJournalReminder";
import SnapshotBanner from "./SnapshotBanner";
import { useLivePrices } from "@/hooks/useLivePrices";
import { useRecentTickers } from "@/hooks/useRecentTickers";
import { useTourSeen } from "@/hooks/useTourSeen";
import { useAnalysisHistory, getHistoryEntry } from "@/hooks/useAnalysisHistory";
import { ANALYSIS_TOUR, HOME_TOUR } from "@/lib/tours";

type ErrorItem = { ticker: string; message: string };
type Stage = keyof Omit<ProgressState, "error" | "tickerStartedAt">;
type ProgressEvent = {
  ticker: string;
  stage: Stage;
  status: "started" | "substep" | "done" | "error";
  substep?: string;
  message?: string;
  durationMs?: number; // server-measured; preferred for display
};

function pendingStage(): StageState {
  return { status: "pending" };
}
function emptyProgress(startedAt?: number): ProgressState {
  return {
    quote: pendingStage(),
    fundamentals: pendingStage(),
    technicals: pendingStage(),
    news: pendingStage(),
    orchestrator: pendingStage(),
    checklist: pendingStage(),
    tickerStartedAt: startedAt,
  };
}

// Session cache — lets the dashboard survive navigation to /decisions and
// back, and lets the browser back button restore previously-analyzed tickers
// without re-running the LLM. Keyed by ticker so multiple runs accumulate.
const SESSION_KEY = "invest.session.v1";

type SessionSnapshot = {
  analyses: Record<string, StockAnalysis>;
  order: string[];
  input: string;
};

function readSession(): SessionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionSnapshot) : null;
  } catch {
    return null;
  }
}
function writeSession(s: SessionSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    // Quota / private mode — not critical.
  }
}
function clearSession() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}


export default function TickerDashboard() {
  const [input, setInput] = useState("");
  const [analyses, setAnalyses] = useState<Record<string, StockAnalysis>>({});
  const [progress, setProgress] = useState<Record<string, ProgressState>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [errors, setErrors] = useState<ErrorItem[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const { recent, push: pushRecent, remove: removeRecent, clear: clearRecent } = useRecentTickers();

  // Refs that runAnalysis needs to reset on each new run. Declared here so
  // they exist in scope by the time the callback fires. Defined / read by
  // the history-save effect further below.
  const lastSavedRunKeyRef = useRef<string | null>(null);
  const suppressNextHistorySaveRef = useRef(false);
  // Snapshot mode — non-null when the user lands via ?restore=<id>, drives
  // the SnapshotBanner so they know prices are frozen.
  const [snapshot, setSnapshot] = useState<
    { savedAt: number; tickers: string[] } | null
  >(null);

  // Accepts either the current input text (default — from Enter/button) or an
  // explicit list (e.g. from a recent-ticker chip click). Keeps the callback
  // API flexible without duplicating analyze logic.
  const runAnalysis = useCallback(async (explicit?: string[]) => {
    const tickers = (
      explicit ??
      input.split(/[\s,;]+/).map((t) => t.trim().toUpperCase()).filter(Boolean)
    )
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    if (tickers.length === 0) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    // Keep any prior analyses in the map — back/forward navigation can
    // restore them without re-running the LLM. Only `order` drives what
    // renders, so stale tickers in `analyses` are free.
    setErrors([]);
    setOrder(tickers);
    // New run: leaving snapshot mode and allowing history to save again.
    setSnapshot(null);
    lastSavedRunKeyRef.current = null;
    suppressNextHistorySaveRef.current = false;
    // Mirror the run into the URL so the browser back button takes the user
    // back to a previous analysis (or to the empty landing state when they
    // pop past the first analysis of the session).
    if (typeof window !== "undefined") {
      const nextUrl = `/?t=${tickers.join(",")}`;
      // Avoid spamming history when re-running the same tickers.
      if (window.location.pathname + window.location.search !== nextUrl) {
        window.history.pushState(null, "", nextUrl);
      }
    }
    // Record the per-ticker start time so ProgressCard can animate its
    // time-based fallback bar even if no SSE events reach the browser.
    const startedAt = Date.now();
    setProgress(Object.fromEntries(tickers.map((t) => [t, emptyProgress(startedAt)])));

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: JSON.stringify({ tickers }),
        headers: { "Content-Type": "application/json" },
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
            const p = ev.data as ProgressEvent;
            setProgress((prev) => {
              const cur = prev[p.ticker] ?? emptyProgress();
              const stage = cur[p.stage] ?? pendingStage();
              const now = Date.now();
              let next: StageState = stage;
              if (p.status === "started") {
                next = { ...stage, status: "running", startedAt: now, substep: stage.substep };
              } else if (p.status === "substep") {
                next = { ...stage, status: stage.status === "pending" ? "running" : stage.status, substep: p.substep };
              } else if (p.status === "done") {
                next = { ...stage, status: "done", finishedAt: now, durationMs: p.durationMs };
              } else if (p.status === "error") {
                next = {
                  ...stage,
                  status: "error",
                  finishedAt: now,
                  substep: p.message,
                  durationMs: p.durationMs,
                };
              }
              return {
                ...prev,
                [p.ticker]: {
                  ...cur,
                  [p.stage]: next,
                  ...(p.status === "error" && p.message ? { error: p.message } : {}),
                },
              };
            });
          } else if (ev.event === "analysis") {
            const a = ev.data as StockAnalysis;
            setAnalyses((prev) => ({ ...prev, [a.ticker]: a }));
            // Push successful analysis into MRU so a chip appears on next load.
            pushRecent([a.ticker]);
          } else if (ev.event === "error") {
            const e = ev.data as ErrorItem;
            setErrors((prev) => [...prev, e]);
            setProgress((prev) => ({
              ...prev,
              [e.ticker]: { ...(prev[e.ticker] ?? emptyProgress()), error: e.message },
            }));
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setErrors((prev) => [...prev, { ticker: "—", message: (err as Error).message }]);
      }
    } finally {
      setLoading(false);
    }
  }, [input, pushRecent]);

  // Bare form/button handler — runs against the current input text.
  const onAnalyze = useCallback(() => runAnalysis(), [runAnalysis]);

  // Persist "last good state" whenever analyses settle. Lets navigation to
  // /decisions (and back) restore the dashboard without re-running the LLM.
  // Only writes when we actually have something worth restoring.
  useEffect(() => {
    if (loading) return;
    if (order.length === 0) return;
    if (!order.some((t) => analyses[t])) return;
    writeSession({ analyses, order, input });
  }, [analyses, order, input, loading]);

  // Persistent history (localStorage). Different from sessionStorage above:
  // survives browser close, cap 30 LRU, viewable at /history, revisitable
  // via ?restore=<id>. We save ONCE per completed run —
  // `lastSavedRunKeyRef` (declared earlier) prevents re-saving when
  // unrelated state changes trigger this effect.
  const history = useAnalysisHistory();

  useEffect(() => {
    if (loading) return;
    if (order.length === 0) return;
    if (!order.every((t) => analyses[t])) return;
    const key = order.join(",");
    if (lastSavedRunKeyRef.current === key) return;
    if (suppressNextHistorySaveRef.current) {
      suppressNextHistorySaveRef.current = false;
      lastSavedRunKeyRef.current = key;
      return;
    }
    lastSavedRunKeyRef.current = key;
    // Clone only the current run's analyses so we don't fatten history
    // with stale tickers from earlier runs (analyses map accumulates).
    const slice = Object.fromEntries(order.map((t) => [t, analyses[t]]));
    history.add({ tickers: order, analyses: slice });
  }, [loading, analyses, order, history]);

  // Track "has any analysis ever been put in the dashboard this session" via
  // a ref so the URL-sync effect can decide between "restore session on
  // first mount" vs "user just navigated to /" without taking `order` as
  // a React dep (which would cause reruns we don't want).
  const hasBeenPopulatedRef = useRef(false);
  useEffect(() => {
    if (order.length > 0) hasBeenPopulatedRef.current = true;
  }, [order]);

  // Reactive URL sync. Next.js re-fires useSearchParams on:
  //   - Link click (logo → /?new=1, Dashboard → /, recent chip → handled locally)
  //   - Browser back / forward button
  // It does NOT re-fire on our own window.history.pushState calls inside
  // runAnalysis, which is deliberate — that path sets state synchronously,
  // so there's nothing to reconcile.
  //
  // Three URL shapes we react to:
  //   - ?new=1 → hard reset (logo click / "start over"). Strip the flag
  //     from the URL after clearing so refresh doesn't re-clear.
  //   - ?t=A,B,C → restore from session if every ticker is cached,
  //     otherwise kick off a fresh analysis for those tickers.
  //   - empty → first visit restores sessionStorage (covers back from
  //     /decisions via Link nav). After the user has interacted this
  //     session, hitting empty URL clears — that's the "logo-esque" path
  //     if the user somehow lands there without the ?new=1 flag.
  const searchParams = useSearchParams();
  useEffect(() => {
    const isNew = searchParams.get("new") === "1";
    const restoreId = searchParams.get("restore");
    const tParam = searchParams.get("t") ?? "";
    const urlTickers = tParam
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);

    // Restore from persistent history — no LLM call, just hydrate. Strips
    // the ?restore flag and rewrites the URL to the canonical `?t=...`
    // shape so refresh / share behave normally from that point on.
    if (restoreId) {
      const entry = getHistoryEntry(restoreId);
      if (entry) {
        abortRef.current?.abort();
        setAnalyses(entry.analyses);
        setOrder(entry.tickers);
        setInput(entry.tickers.join(" "));
        setProgress({});
        setErrors([]);
        setSnapshot({ savedAt: entry.savedAt, tickers: entry.tickers });
        suppressNextHistorySaveRef.current = true;
        writeSession({
          analyses: entry.analyses,
          order: entry.tickers,
          input: "",
        });
        if (typeof window !== "undefined") {
          window.history.replaceState(
            null,
            "",
            `/?t=${entry.tickers.join(",")}`,
          );
        }
      } else {
        // Entry was deleted or quota-evicted — fall back to empty state.
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", "/");
        }
      }
      return;
    }

    if (isNew) {
      abortRef.current?.abort();
      setAnalyses({});
      setOrder([]);
      setProgress({});
      setErrors([]);
      setInput("");
      clearSession();
      hasBeenPopulatedRef.current = false;
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", "/");
      }
      return;
    }

    if (urlTickers.length > 0) {
      const saved = readSession();
      if (saved && urlTickers.every((t) => saved.analyses[t])) {
        setAnalyses(saved.analyses);
        setOrder(urlTickers);
        setInput(saved.input ?? urlTickers.join(" "));
      } else {
        runAnalysis(urlTickers);
      }
      return;
    }

    // URL empty. If the dashboard has been populated already this session,
    // treat the empty URL as an explicit "go home" → clear. Otherwise this
    // is the initial mount, so try to restore from sessionStorage.
    if (hasBeenPopulatedRef.current) {
      abortRef.current?.abort();
      setAnalyses({});
      setOrder([]);
      setProgress({});
      setErrors([]);
      setInput("");
      clearSession();
      hasBeenPopulatedRef.current = false;
      return;
    }
    const saved = readSession();
    if (saved && saved.order.length > 0) {
      setAnalyses(saved.analyses);
      setOrder(saved.order);
      setInput(saved.input ?? "");
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `/?t=${saved.order.join(",")}`);
      }
    }
    // runAnalysis is the only non-state dep; intentionally excluded so this
    // effect only re-runs when the URL changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Chip click — analyze exactly the picked ticker and reflect it in the input.
  const onPickRecent = useCallback(
    (ticker: string) => {
      setInput(ticker);
      runAnalysis([ticker]);
    },
    [runAnalysis],
  );

  // Subscribe live quotes for every ticker whose analysis has landed. Tickers
  // still running show the progress card (no live data needed yet).
  const liveTickers = order.filter((t) => analyses[t]);
  const { prices: livePrices, status: liveStatus } = useLivePrices(liveTickers);

  const hasStarted = order.length > 0;
  const hasAnalysis = Object.keys(analyses).length > 0;

  // Guided-tour state. Two tours share the same overlay — which one runs is
  // driven by the currently-visible screen (empty state vs. analysis card).
  const homeTour = useTourSeen("home");
  const analysisTour = useTourSeen("analysis");
  const [activeTour, setActiveTour] = useState<"home" | "analysis" | null>(null);

  // Auto-launch the welcome tour on an unseen first visit (once hydration
  // has told us whether the flag is set). Only when the empty-state hero is
  // visible so selectors actually match.
  useEffect(() => {
    if (activeTour) return;
    if (homeTour.seen === false && !hasStarted) {
      setActiveTour("home");
    }
  }, [homeTour.seen, hasStarted, activeTour]);

  // Auto-launch the post-analysis tour the first time a completed card lands.
  useEffect(() => {
    if (activeTour) return;
    if (analysisTour.seen === false && hasAnalysis) {
      setActiveTour("analysis");
    }
  }, [analysisTour.seen, hasAnalysis, activeTour]);

  // Replay button — picks the most contextually useful tour for the current
  // screen state. Doesn't flip the "seen" flag; that only happens on finish.
  const replayTour = useCallback(() => {
    setActiveTour(hasAnalysis ? "analysis" : "home");
  }, [hasAnalysis]);

  // Any exit (Skip / Esc / backdrop / Done) marks the current tour as seen,
  // otherwise a user who closes it would get it again on the next page load,
  // which feels like a bug. The "Guide me" replay button stays available.
  const closeTour = useCallback(() => {
    if (activeTour === "home") homeTour.markSeen();
    if (activeTour === "analysis") analysisTour.markSeen();
    setActiveTour(null);
  }, [activeTour, homeTour, analysisTour]);
  const finishTour = useCallback(() => {
    if (activeTour === "home") homeTour.markSeen();
    if (activeTour === "analysis") analysisTour.markSeen();
  }, [activeTour, homeTour, analysisTour]);

  return (
    <div className="flex flex-col gap-6">
      {/* Journal nudge — only appears if the user has saved entries whose
          re-check date has arrived. Dismissible per-session. */}
      <DecisionJournalReminder />

      {/* Snapshot banner — shown when the user opened a saved analysis from
          /history. Communicates that the displayed data is frozen and
          offers a one-click re-analyze against today's prices. */}
      {snapshot && (
        <SnapshotBanner
          savedAt={snapshot.savedAt}
          tickers={snapshot.tickers}
          onRefresh={() => {
            setSnapshot(null);
            runAnalysis(snapshot.tickers);
          }}
        />
      )}

      {/* Hero: centered on first load for a clean blank-slate feel. Collapses
          to a slim bar once analysis starts so the cards can breathe. */}
      {hasStarted ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <TickerAutocomplete
              value={input}
              onChange={setInput}
              onSubmit={onAnalyze}
              disabled={loading}
              placeholder="Enter ticker here"
              className="flex-1"
            />
            <button
              onClick={onAnalyze}
              disabled={loading}
              className="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white px-5 py-2 text-sm font-medium shadow-sm"
            >
              {loading ? "Analyzing…" : "Analyze another stock"}
            </button>
            <button
              type="button"
              onClick={replayTour}
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-300"
              title="Replay the guided tour"
            >
              ? Guide me
            </button>
          </div>
          <RecentTickersBar
            recent={recent}
            onPick={onPickRecent}
            onRemove={removeRecent}
            onClear={clearRecent}
          />
        </div>
      ) : (
        <section className="min-h-[55vh] flex flex-col items-center justify-center gap-5 text-center">
          {/* Welcome heading — only on the empty-state hero. Emojis are kept
              OUTSIDE the gradient span because `bg-clip-text: text-transparent`
              turns emoji color glyphs into empty blocks. */}
          <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              <span className="bg-gradient-to-r from-emerald-700 to-teal-600 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">
                Hey there
              </span>{" "}
              <span role="img" aria-label="waving hand">👋</span>
            </h1>
            <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">
              Let&apos;s investigate a stock — no spreadsheets required.
            </p>
          </div>
          <div className="w-full max-w-2xl flex flex-col sm:flex-row gap-2">
            <div data-tour="home-input" className="flex-1">
              <TickerAutocomplete
                value={input}
                onChange={setInput}
                onSubmit={onAnalyze}
                disabled={loading}
                placeholder="Enter ticker here"
                className="w-full"
              />
            </div>
            <button
              data-tour="home-analyze"
              onClick={onAnalyze}
              disabled={loading || !input.trim()}
              className="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white px-6 py-2 text-sm font-medium shadow-sm transition-transform hover:scale-[1.02]"
            >
              {loading ? "Analyzing…" : "Analyze"}
            </button>
          </div>
          <p data-tour="cmdk-hint" className="text-xs text-zinc-500 font-mono">
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">↵</kbd>{" "}
            to analyze &nbsp;·&nbsp;{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">↑</kbd>{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">↓</kbd>{" "}
            to pick from suggestions &nbsp;·&nbsp;{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">⌘K</kbd>{" "}
            for the command palette
          </p>
          <div className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            A team of specialist agents (fundamentals, technicals, news) will each analyze your
            ticker in parallel, and an orchestrator will produce an educational signal with
            plain-English reasoning.
          </div>
          <div data-tour="home-educator">
            <EducatorNudge variant="hero" />
          </div>
          {/* Recent tickers — only rendered if we have history (post-hydration). */}
          <div data-tour="home-recent" className="w-full max-w-2xl">
            <RecentTickersBar
              recent={recent}
              onPick={onPickRecent}
              onRemove={removeRecent}
              onClear={clearRecent}
            />
          </div>
          <button
            type="button"
            onClick={replayTour}
            className="mt-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline underline-offset-2"
          >
            Take a guided tour
          </button>
        </section>
      )}

      <div className="flex flex-col gap-6">
        {order.map((t) => {
          const a = analyses[t];
          if (a)
            return (
              <DetailedStockCard
                key={t}
                a={a}
                live={livePrices[t]}
                liveStatus={liveStatus}
              />
            );
          return <ProgressCard key={t} ticker={t} state={progress[t] ?? emptyProgress()} />;
        })}
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 p-3 text-sm text-rose-800 dark:text-rose-200">
          <div className="font-semibold">
            I&apos;m having trouble generating the analysis. Please try again later.
          </div>
          <div className="mt-1 text-xs text-rose-700/80 dark:text-rose-300/80">
            Affected:{" "}
            {errors.map((e, i) => (
              <span key={i} className="font-mono">
                {e.ticker}
                {i < errors.length - 1 ? ", " : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Guided tour overlay. Step set swaps based on the current screen. Any
          dismissal (Skip / Esc / backdrop / Done) marks the tour as seen so
          it doesn't auto-replay. Use the "Guide me" button to re-run. */}
      <GuidedTour
        steps={activeTour === "analysis" ? ANALYSIS_TOUR : HOME_TOUR}
        open={activeTour !== null}
        onClose={closeTour}
        onFinish={finishTour}
      />
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
