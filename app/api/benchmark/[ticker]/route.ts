// GET /api/benchmark/:ticker?range=1y|5y
// Returns daily close history for a benchmark ticker (we use SPY). Used by
// the Time-Machine backtest card to compare "your stock" vs "the market"
// over the same window. Runs only when the user actually opens the card.
//
// Keeps the analyze payload lean — if we pre-bundled SPY history into every
// StockAnalysis response, every ticker analysis would carry an extra few KB
// whether the backtest card was opened or not.

import { NextRequest, NextResponse } from "next/server";
import { getHistorical } from "@/lib/tools/yahoo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Range = "1y" | "5y";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await ctx.params;
  const rangeParam = req.nextUrl.searchParams.get("range")?.toLowerCase();
  const range: Range = rangeParam === "1y" ? "1y" : "5y";
  try {
    const bars = await getHistorical(ticker.toUpperCase(), range);
    return NextResponse.json({
      data: bars.map((b) => ({ date: b.date, close: b.close })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
