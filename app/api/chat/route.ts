// POST /api/chat { history, message } -> SSE stream of {type, content} events
// Runs the Educator agent's tool-use loop and streams text + tool-call notices.
// See /api/analyze/route.ts for the rationale behind the 8 KB initial flush,
// per-event padding, and the NO-setInterval rule.

import { NextRequest } from "next/server";
import { educatorStream, type ChatMessage } from "@/lib/agents/educator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const EVENT_PAD = `\n: ${"x".repeat(1024)}\n\n`;

export async function POST(req: NextRequest) {
  const { history, message } = (await req.json()) as { history: ChatMessage[]; message: string };
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

      // 8 KB initial padded comment.
      safeEnqueue(encoder.encode(`: ${" ".repeat(8192)}\n\n`));

      const send = (event: string, content: string) => {
        safeEnqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify({ content })}\n\n${EVENT_PAD}`,
          ),
        );
      };

      try {
        for await (const chunk of educatorStream(history ?? [], message)) {
          send(chunk.type, chunk.content);
        }
      } catch (err) {
        send("error", err instanceof Error ? err.message : String(err));
      } finally {
        safeEnqueue(encoder.encode(`event: done\ndata: {}\n\n`));
        closed = true;
        try {
          controller.close();
        } catch {}
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
