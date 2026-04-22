// POST /api/portfolio/summarize { tickers: string[] }
//
// Runs the Portfolio agent and streams the result via SSE. Only two
// interesting events:
//   - progress: { stage } — "fetching" | "thinking"
//   - result:   { insights } — the final PortfolioInsights payload
//
// The shape mirrors /api/analyze — same anti-buffering padding pattern, so
// the "Summarize my portfolio" button can show a live progress indicator
// while the fetch + LLM work happens.

import { NextRequest } from "next/server";
import { summarizePortfolio } from "@/lib/agents/portfolio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const EVENT_PAD = `\n: ${"x".repeat(1024)}\n\n`;

export async function POST(req: NextRequest) {
  // Guard empty / malformed body so a stale refresh doesn't crash the
  // route (same pattern as /api/analyze).
  let body: { tickers?: unknown } = {};
  try {
    const raw = await req.text();
    body = raw ? (JSON.parse(raw) as { tickers?: unknown }) : {};
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const tickers = Array.isArray(body.tickers) ? (body.tickers as string[]) : [];
  const cleaned = tickers
    .map((t) => String(t ?? "").trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 50);
  if (cleaned.length === 0) {
    return Response.json({ error: "no tickers provided" }, { status: 400 });
  }

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
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n${EVENT_PAD}`,
          ),
        );
      };

      // 8 KB initial flush to bust upstream proxy buffering.
      safeEnqueue(encoder.encode(`: ${" ".repeat(8192)}\n\n`));

      try {
        send("progress", { stage: "fetching" });
        // summarizePortfolio itself runs the fetch concurrently before the
        // LLM, so we only emit two progress events — no fine-grained
        // streaming from inside the function. Keeps the implementation
        // simple; the whole thing finishes in ~5-10 s anyway.
        send("progress", { stage: "thinking" });
        const insights = await summarizePortfolio({ tickers: cleaned });
        send("result", { insights });
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        send("done", {});
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
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
