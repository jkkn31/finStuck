// POST /api/analyze { tickers: string[] }
// SSE events:
//   start    — { tickers }
//   progress — { ticker, stage, status, message? }
//   analysis — full StockAnalysis
//   error    — { ticker, message }
//   done     — {}
//
// Vercel streaming lessons learned the hard way:
//   1. Vercel's gateway buffers responses by default. `X-Accel-Buffering: no`
//      is the nginx-compatible hint to disable that.
//   2. An 8 KB initial padded comment is needed to push past the gateway
//      buffer threshold (usually 4-8 KB).
//   3. DO NOT use `setInterval` for heartbeats inside the stream. On Vercel
//      Node runtime, a pending timer keeps the event loop alive EVEN AFTER
//      the Response body is closed — the function runs until maxDuration
//      (60 s on Hobby) and gets killed. Instead, pad each real event inline
//      with a ~1 KB comment so every send() forces a proxy flush, without
//      needing a background timer.

import { NextRequest } from "next/server";
import { analyzeStock, isInvalidTickerError } from "@/lib/agents/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Padding used to bust through proxy buffers. SSE spec: any line starting
// with `:` is a comment and is ignored by conforming parsers, including
// ours in TickerDashboard.
const EVENT_PAD = `\n: ${"x".repeat(1024)}\n\n`;

// Generic, beginner-friendly message shown to the user when analysis fails
// after all retries. Replaces raw LLM/Yahoo error text — those are useful in
// server logs but scary/confusing in the UI.
const FRIENDLY_ERROR = "I'm having trouble generating the analysis. Please try again later.";

// Max attempts per ticker (original try + N-1 retries). Kept to 2 because
// Vercel Hobby caps functions at 60 s and an analysis takes ~15-25 s —
// retrying more often risks hitting the cap mid-retry.
const MAX_ATTEMPTS = 2;
const RETRY_BACKOFF_MS = 1500;

export async function POST(req: NextRequest) {
  // Guard the body parse — an empty or malformed body (e.g. a page refresh
  // that aborted the previous fetch) would otherwise crash the route with
  // "Unexpected end of JSON input".
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
    .slice(0, 10);
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

      // Each event is followed by a 1 KB padding comment. Ensures every
      // user-visible send() pushes enough bytes for the gateway to flush
      // immediately — without a background timer blocking termination.
      const send = (event: string, data: unknown) => {
        safeEnqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n${EVENT_PAD}`,
          ),
        );
      };

      // Initial 8 KB padded comment to flush response headers + first window
      // through any proxy buffer threshold.
      safeEnqueue(encoder.encode(`: ${" ".repeat(8192)}\n\n`));

      try {
        send("start", { tickers: cleaned });

        await Promise.all(
          cleaned.map(async (t) => {
            // Retry up to MAX_ATTEMPTS-1 times on transient errors. Skip the
            // retry entirely for terminal errors (e.g. invalid ticker) —
            // retrying won't help and just wastes 20 s of inference time.
            let lastError: unknown = null;
            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
              try {
                const analysis = await analyzeStock(t, (p) => send("progress", p));
                send("analysis", analysis);
                return;
              } catch (err) {
                lastError = err;
                const terminal = isInvalidTickerError(err);
                const willRetry = !terminal && attempt < MAX_ATTEMPTS;
                console.warn(
                  `[analyze] ${t} attempt ${attempt}/${MAX_ATTEMPTS} failed` +
                    (terminal ? " (terminal — no retry)" : willRetry ? ", retrying…" : " (giving up)"),
                  err,
                );
                if (!willRetry) break;
                await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
              }
            }
            // All attempts exhausted — surface a friendly message, not the
            // raw error. Raw error is still in server logs for debugging.
            console.error(`[analyze] ${t} all attempts failed`, lastError);
            send("error", { ticker: t, message: FRIENDLY_ERROR });
          }),
        );

        send("done", {});
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed (e.g. client disconnected)
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
