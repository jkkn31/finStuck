"use client";

import { useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string; tools?: string[] };

export default function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm the Educator. Ask me things like 'what is a P/E ratio?', 'why is AAPL down today?', or 'how is my portfolio diversified?'",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send() {
    const msg = input.trim();
    if (!msg || busy) return;
    setInput("");
    const newMsgs: Msg[] = [...messages, { role: "user", content: msg }, { role: "assistant", content: "", tools: [] }];
    setMessages(newMsgs);
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: messages
            .filter((m) => m.content)
            .map((m) => ({ role: m.role, content: m.content })),
          message: msg,
        }),
      });
      if (!res.body) throw new Error("no body");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const ev = parseSSE(buf.slice(0, idx));
          buf = buf.slice(idx + 2);
          if (!ev) continue;
          setMessages((prev) => {
            // State updater MUST be pure — React StrictMode (dev) invokes
            // it twice to catch exactly this. Mutating `last` directly
            // double-appended the streamed text on every chunk, which is
            // what produced the duplicated-answer bug.
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            const updated: Msg = { ...last };
            if (ev.event === "text") {
              const text = (ev.data as { content: string }).content;
              updated.content = updated.content ? `${updated.content}\n\n${text}` : text;
            } else if (ev.event === "tool") {
              updated.tools = [...(updated.tools ?? []), (ev.data as { content: string }).content];
            } else if (ev.event === "error") {
              updated.content = `⚠️ ${(ev.data as { content: string }).content}`;
            } else {
              return prev;
            }
            return [...prev.slice(0, -1), updated];
          });
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: `⚠️ ${(err as Error).message}` };
        return next;
      });
    } finally {
      setBusy(false);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 shadow-lg z-40 text-sm font-medium"
      >
        {open ? "Close" : "Ask Educator"}
      </button>

      {open && (
        <div className="fixed bottom-16 right-4 w-[min(92vw,380px)] h-[70vh] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col z-40">
          <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 text-sm font-semibold">
            Educator · conversational agent
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : ""}>
                <div
                  className={`inline-block rounded-2xl px-3 py-2 max-w-[90%] whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100"
                  }`}
                >
                  {m.content || (busy && i === messages.length - 1 ? "…" : "")}
                </div>
                {m.tools && m.tools.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {m.tools.map((t, j) => (
                      <div key={j} className="text-[10px] font-mono text-zinc-500">
                        {t}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="p-2 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask anything…"
              disabled={busy}
              className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
            />
            <button
              onClick={send}
              disabled={busy}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 text-sm"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function parseSSE(raw: string): { event: string; data: unknown } | null {
  const lines = raw.split("\n");
  let event = "message";
  const dataParts: string[] = [];
  for (const l of lines) {
    if (l.startsWith("event:")) event = l.slice(6).trim();
    else if (l.startsWith("data:")) dataParts.push(l.slice(5).trim());
  }
  if (dataParts.length === 0) return null;
  try {
    return { event, data: JSON.parse(dataParts.join("\n")) };
  } catch {
    return null;
  }
}
