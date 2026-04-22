// Input + S&P 500 autocomplete dropdown. Supports comma-separated tickers —
// we only filter the LAST token, so earlier entries stay intact while you
// type a new one. Keyboard nav: ↑ / ↓ / Enter / Esc.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { filterTickers, type Sp500Entry } from "@/lib/sp500";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export default function TickerAutocomplete({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Split the input into (prefix = all completed tokens, trailing separator
  // included) and (current = the token being typed). Only the current token
  // drives suggestions.
  const { prefix, current } = useMemo(() => splitTrailing(value), [value]);

  const suggestions = useMemo(
    () => (current ? filterTickers(current, 8) : []),
    [current],
  );

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Reset active index whenever the suggestion set changes.
  useEffect(() => {
    setActiveIdx(0);
  }, [suggestions.length, current]);

  const shouldShow = open && suggestions.length > 0;

  const applySuggestion = useCallback(
    (entry: Sp500Entry) => {
      // Replace the current token with the picked ticker, then add ", "
      // so the user can keep typing additional symbols fluidly.
      onChange(`${prefix}${entry.s}, `);
      setOpen(false);
      // Keep focus in the input for the next ticker.
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [prefix, onChange],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (shouldShow) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter") {
        // Enter with a highlighted suggestion picks it; otherwise submit the form.
        e.preventDefault();
        applySuggestion(suggestions[activeIdx]);
        return;
      }
      if (e.key === "Tab") {
        // Tab also accepts the highlighted suggestion (common typeahead UX).
        if (suggestions[activeIdx]) {
          e.preventDefault();
          applySuggestion(suggestions[activeIdx]);
        }
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
    } else if (e.key === "Enter") {
      onSubmit();
    }
  };

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-900/40 transition-shadow placeholder:text-zinc-400"
      />
      {shouldShow && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-80 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.s}
              role="option"
              aria-selected={i === activeIdx}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseDown={(e) => {
                // onMouseDown (not onClick) so the input doesn't lose focus
                // and the outside-click handler doesn't race us.
                e.preventDefault();
                applySuggestion(s);
              }}
              className={
                i === activeIdx
                  ? "flex items-center gap-3 px-3 py-2 text-sm bg-emerald-50 dark:bg-emerald-950/40 cursor-pointer"
                  : "flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              }
            >
              <span className="font-mono font-semibold w-14 shrink-0">{s.s}</span>
              <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">{s.n}</span>
              <span className="text-[10px] uppercase tracking-wide text-zinc-500 shrink-0">
                {s.sec}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Given "AAPL, MSFT, nv" → { prefix: "AAPL, MSFT, ", current: "nv" }.
// The `current` token is what drives suggestions.
function splitTrailing(input: string): { prefix: string; current: string } {
  // Look for the last separator (comma, semicolon, or whitespace).
  const m = input.match(/^(.*[\s,;])([^\s,;]*)$/);
  if (!m) return { prefix: "", current: input };
  return { prefix: m[1], current: m[2] };
}
