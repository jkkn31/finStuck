// Global ⌘K / Ctrl+K command palette.
//
// - Fuzzy-search S&P 500 tickers (reuses the autocomplete's filter)
// - Quick-nav to Dashboard / Portfolio / Profile
// - Ticker selection navigates to /stock/[ticker] — cheapest action, avoids
//   racing the dashboard's in-flight analyses
// - Keyboard: ↑/↓, Enter, Esc
//
// No external deps (cmdk was overkill for this scope). ~160 lines, one focus
// trap, closes on outside click or Esc.

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { filterTickers, type Sp500Entry } from "@/lib/sp500";

type NavAction = { kind: "nav"; label: string; href: string; hint?: string };
type TickerAction = { kind: "ticker"; entry: Sp500Entry };
type Action = NavAction | TickerAction;

const NAV_ACTIONS: NavAction[] = [
  { kind: "nav", label: "Dashboard", href: "/", hint: "Home" },
];

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global ⌘K / Ctrl+K listener.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus the input and reset state each time the palette opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const actions: Action[] = useMemo(() => {
    const q = query.trim();
    if (!q) {
      // Empty query: show nav shortcuts as a starter.
      return NAV_ACTIONS;
    }
    const nav = NAV_ACTIONS.filter((a) => a.label.toLowerCase().includes(q.toLowerCase()));
    const tickers: TickerAction[] = filterTickers(q, 10).map((entry) => ({
      kind: "ticker",
      entry,
    }));
    return [...nav, ...tickers];
  }, [query]);

  const runAction = useCallback(
    (a: Action) => {
      setOpen(false);
      if (a.kind === "nav") {
        router.push(a.href);
      } else {
        // Navigate to the detail page — it will run the analysis server-side.
        router.push(`/stock/${a.entry.s}`);
      }
    },
    [router],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (actions.length === 0 ? 0 : (i + 1) % actions.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (actions.length === 0 ? 0 : (i - 1 + actions.length) % actions.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (actions[activeIdx]) runAction(actions[activeIdx]);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[18vh] bg-black/30 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <span className="text-zinc-400" aria-hidden>
            ⌘
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search tickers or pages…"
            spellCheck={false}
            autoComplete="off"
            className="flex-1 bg-transparent text-sm placeholder:text-zinc-400 focus:outline-none"
          />
          <kbd className="hidden sm:inline px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700">
            Esc
          </kbd>
        </div>
        <ul role="listbox" className="max-h-80 overflow-auto">
          {actions.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-zinc-500">No matches.</li>
          )}
          {actions.map((a, i) => (
            <li
              key={a.kind === "nav" ? `nav:${a.href}` : `tk:${a.entry.s}`}
              role="option"
              aria-selected={i === activeIdx}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                runAction(a);
              }}
              className={
                i === activeIdx
                  ? "flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer bg-emerald-50 dark:bg-emerald-950/40"
                  : "flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              }
            >
              {a.kind === "nav" ? (
                <>
                  <span className="w-14 shrink-0 text-zinc-400 text-[10px] uppercase tracking-wide">Go</span>
                  <span className="flex-1 font-medium">{a.label}</span>
                  {a.hint && <span className="text-xs text-zinc-500">{a.hint}</span>}
                </>
              ) : (
                <>
                  <span className="w-14 shrink-0 font-mono font-semibold text-zinc-700 dark:text-zinc-200">{a.entry.s}</span>
                  <span className="flex-1 truncate">{a.entry.n}</span>
                  <span className="text-[10px] uppercase tracking-wide text-zinc-500 shrink-0">
                    {a.entry.sec}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 font-mono">
          <span>
            <kbd className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 mr-1">↑</kbd>
            <kbd className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 mr-2">↓</kbd>
            to navigate
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">↵</kbd>{" "}
            to open
          </span>
        </div>
      </div>
    </div>
  );
}
