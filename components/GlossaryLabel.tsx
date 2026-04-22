// Technical-term label with a hover tooltip and a subtle dotted underline.
// Used in stats grids where labels like "SMA 50" or "RSI(14)" would confuse
// a beginner. Definitions are intentionally short + concrete — a single
// sentence that a non-investor can grok.

"use client";

import { useState } from "react";

export type GlossaryTerm =
  | "52W_HIGH"
  | "52W_LOW"
  | "SMA_50"
  | "SMA_200"
  | "RSI"
  | "TREND"
  | "PE"
  | "FORWARD_PE"
  | "PEG"
  | "EPS_TTM"
  | "REVENUE_GROWTH"
  | "PROFIT_MARGIN"
  | "DEBT_EQUITY"
  | "MAX_DRAWDOWN"
  | "RECOVERY_MONTHS";

// Keep definitions concise, plain-English, with a relatable mental model.
const DEFS: Record<GlossaryTerm, string> = {
  "52W_HIGH":
    "The highest price the stock has traded at in the last 12 months. If today's price is near it, the stock has been doing well lately.",
  "52W_LOW":
    "The lowest price the stock has traded at in the last 12 months. Near this level, the stock has been struggling — could be a bargain or a warning.",
  SMA_50:
    "50-day average price. Smooths out the daily noise to show the short-term trend. Price above it = short-term uptrend.",
  SMA_200:
    "200-day average price. Shows the long-term trend. Price above it = the stock's in a long-term uptrend, often called a 'bull' market for that stock.",
  RSI:
    "A number from 0 to 100 measuring if the stock has moved too fast recently. Above 70 = may have run too hot. Below 30 = may have fallen too far.",
  TREND:
    "Which direction the stock has been going overall: up, down, or sideways. Based on whether the price is above/below its 50- and 200-day averages.",
  PE:
    "Price-to-Earnings. For every $1 of yearly profit the company makes, how many dollars does the stock cost? Lower = cheaper. Above ~30 is usually expensive.",
  FORWARD_PE:
    "Same as P/E but using next year's expected profit instead of past profit. Useful for growing companies.",
  PEG:
    "P/E divided by the growth rate. Below 1 = you're paying a fair price for the growth you're buying. Above 2 = you're paying a lot for the growth.",
  EPS_TTM:
    "Earnings Per Share (trailing 12 months). How much profit the company made per share over the last year. Bigger is better.",
  REVENUE_GROWTH:
    "How much more the company sold this year vs last year, as a percentage. Above 10% is healthy. Negative means the business is shrinking.",
  PROFIT_MARGIN:
    "Out of every $1 of sales, how many cents the company keeps as profit. Above 15% is strong. Below 5% is weak.",
  DEBT_EQUITY:
    "How much the company owes vs what shareholders own. Below 1 is conservative. Above 2 is risky for most companies — but normal for banks and utilities.",
  MAX_DRAWDOWN:
    "The biggest drop from a peak to a later low in the time window. If you had bought at the peak and panic-sold at the bottom, this is how much you'd have lost.",
  RECOVERY_MONTHS:
    "How long it took, after the worst drop, for the price to climb back to its previous peak. Teaches you that even strong stocks can make you wait years.",
};

export default function GlossaryLabel({
  term,
  children,
}: {
  term: GlossaryTerm;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const def = DEFS[term];

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      <span className="border-b border-dotted border-zinc-400/60 cursor-help">
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 bottom-full mb-1.5 z-30 w-64 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg p-2.5 text-[11px] normal-case tracking-normal text-zinc-700 dark:text-zinc-200 leading-snug"
        >
          {def}
        </span>
      )}
    </span>
  );
}
