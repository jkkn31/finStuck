// GET /api/quotes?t=AAPL,MSFT,NVDA
//
// Batch quote lookup for the portfolio page. Returns current price, today's
// change, and company name for each ticker. Uses the same cached getQuote
// the analyze pipeline uses, so a holding already shown on the dashboard
// is near-free to look up here.
//
// Clamped at 50 tickers per request — the portfolio page doesn't need more
// and the clamp keeps a malicious / runaway query from hammering Yahoo.

import { NextRequest, NextResponse } from "next/server";
import { getQuote, type Quote } from "@/lib/tools/yahoo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TICKERS = 50;

type Result =
  | { ticker: string; ok: true; quote: Quote }
  | { ticker: string; ok: false; error: string };

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("t") ?? "";
  const tickers = raw
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, MAX_TICKERS);

  if (tickers.length === 0) {
    return NextResponse.json({ error: "no tickers provided" }, { status: 400 });
  }

  const results: Result[] = await Promise.all(
    tickers.map(
      async (ticker): Promise<Result> => {
        try {
          const quote = await getQuote(ticker);
          return { ticker, ok: true, quote };
        } catch (err) {
          return {
            ticker,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      },
    ),
  );

  return NextResponse.json({ data: results });
}
