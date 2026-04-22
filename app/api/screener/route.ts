// GET /api/screener
//
// Streams one `row` event per ticker in the curated universe. Each row
// includes period returns (1D / 1W / 1M / YTD / 1Y), the technical signals
// the baseline filter uses (price-vs-SMA50, RSI, volume trend), and the
// next earnings date for the UI badge.
//
// No server-side filtering — the page decides what's healthy and what to
// rank so period/direction flips are instant, no round-trip.
//
// Concurrency is capped at 8 because Yahoo's unofficial API soft-rate-
// limits around 10 parallel requests. Each ticker pulls quote +
// quoteSummary + 1Y history (three cached calls).

import { NextRequest } from "next/server";
import { getQuote, getQuoteSummary, getHistorical } from "@/lib/tools/yahoo";
import { snapshot } from "@/lib/tools/indicators";
import { SP500 } from "@/lib/sp500";
import {
  SCREENER_UNIVERSE,
  daysUntil,
  daysForPeriod,
  passesHealthyBaseline,
  periodReturn,
  ytdReturn,
  type ScreenerRow,
} from "@/lib/screener";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONCURRENCY = 8;

export async function GET(_req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const safeEnqueue = (bytes: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(bytes);
        } catch {
          closed = true;
        }
      };
      const send = (event: string, data: unknown) => {
        safeEnqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      // Flush headers past any upstream proxy buffer.
      safeEnqueue(encoder.encode(`: ${" ".repeat(2048)}\n\n`));

      send("start", { total: SCREENER_UNIVERSE.length });

      const queue = [...SCREENER_UNIVERSE];
      let completed = 0;
      const workers: Promise<void>[] = [];
      for (let w = 0; w < CONCURRENCY; w++) {
        workers.push(
          (async () => {
            while (queue.length > 0 && !closed) {
              const ticker = queue.shift();
              if (!ticker) break;
              try {
                const row = await buildRow(ticker);
                send("row", row);
              } catch (err) {
                send("row", errorRow(ticker, err));
              } finally {
                completed++;
                send("progress", { completed, total: SCREENER_UNIVERSE.length });
              }
            }
          })(),
        );
      }
      await Promise.all(workers);

      send("done", {});
      closed = true;
      try {
        controller.close();
      } catch {
        // already closed
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}

async function buildRow(ticker: string): Promise<ScreenerRow> {
  const fromStatic = SP500.find(
    (e) => e.s === ticker || e.s === ticker.replace("-", "."),
  );

  const [quote, summary, history] = await Promise.all([
    getQuote(ticker).catch((): null => null),
    getQuoteSummary(ticker).catch((): null => null),
    getHistorical(ticker, "1y").catch((): null => null),
  ]);

  const closes = history ? history.map((h) => h.close) : [];
  const volumes = history ? history.map((h) => h.volume) : [];
  const snap = closes.length > 0 ? snapshot(closes, volumes) : null;

  // Period returns. 1D prefers quote's intraday change (more responsive);
  // others come from daily-close history.
  const quoteReturn1d =
    quote?.changePercent != null ? quote.changePercent / 100 : null;
  const histReturn1d = periodReturn(closes, daysForPeriod("1d"));
  const return1d = quoteReturn1d ?? histReturn1d;
  const return1w = periodReturn(closes, daysForPeriod("1w"));
  const return1m = periodReturn(closes, daysForPeriod("1m"));
  const return1y = periodReturn(closes, daysForPeriod("1y"));
  const returnYtd = history ? ytdReturn(history) : null;

  const nextEarningsDate = summary?.nextEarningsDate ?? null;

  const base: ScreenerRow = {
    ticker,
    name: summary?.name ?? fromStatic?.n ?? quote?.name ?? ticker,
    sector: summary?.sector ?? fromStatic?.sec ?? null,
    industry: summary?.industry ?? null,
    price: quote?.price ?? snap?.price ?? null,
    marketCap: quote?.marketCap ?? null,

    peRatio: summary?.peRatio ?? null,
    pegRatio: summary?.pegRatio ?? null,
    revenueGrowthYoY: summary?.revenueGrowth ?? null,
    profitMargin: summary?.profitMargin ?? null,

    rsi14: snap?.rsi14 ?? null,
    sma50: snap?.sma50 ?? null,
    priceVsSma50Pct: snap?.priceVsSma50Pct ?? null,
    volumeTrendPct: snap?.volumeTrendPct ?? null,

    nextEarningsDate,
    daysToEarnings: daysUntil(nextEarningsDate),

    return1d,
    return1w,
    return1m,
    returnYtd,
    return1y,

    isHealthy: false, // set below
  };

  if (!quote && !summary && !snap) {
    return {
      ...base,
      error: "no data from Yahoo (possibly delisted or renamed)",
    };
  }

  base.isHealthy = passesHealthyBaseline(base);
  return base;
}

function errorRow(ticker: string, err: unknown): ScreenerRow {
  const fromStatic = SP500.find((e) => e.s === ticker);
  return {
    ticker,
    name: fromStatic?.n ?? ticker,
    sector: fromStatic?.sec ?? null,
    industry: null,
    price: null,
    marketCap: null,
    peRatio: null,
    pegRatio: null,
    revenueGrowthYoY: null,
    profitMargin: null,
    rsi14: null,
    sma50: null,
    priceVsSma50Pct: null,
    volumeTrendPct: null,
    nextEarningsDate: null,
    daysToEarnings: null,
    return1d: null,
    return1w: null,
    return1m: null,
    returnYtd: null,
    return1y: null,
    isHealthy: false,
    error: err instanceof Error ? err.message : String(err),
  };
}
