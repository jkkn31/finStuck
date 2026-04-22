// GET /api/history/:ticker?range=1d|1w
// Returns intraday bars (5-min for 1d, 30-min for 1w) for the PriceChart's
// short-range toggles. Longer ranges (1M..5Y) are served client-side from the
// 5Y daily history already included in the analyze response.

import { NextRequest, NextResponse } from "next/server";
import { getIntradayHistory } from "@/lib/tools/yahoo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Range = "1d" | "1w";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await ctx.params;
  const rangeParam = req.nextUrl.searchParams.get("range")?.toLowerCase();
  if (rangeParam !== "1d" && rangeParam !== "1w") {
    return NextResponse.json({ error: "range must be 1d or 1w" }, { status: 400 });
  }
  try {
    const bars = await getIntradayHistory(ticker.toUpperCase(), rangeParam as Range);
    return NextResponse.json({
      data: bars.map((b) => ({ date: b.date, close: b.close, volume: b.volume })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
