// Finnhub WebSocket live-price hook.
//
// One persistent WebSocket shared across the whole dashboard. When the tickers
// list changes we diff against currently-subscribed symbols and send the
// minimum set of subscribe/unsubscribe messages — no teardown required.
//
// Usage:
//   const { prices, status } = useLivePrices(["AAPL", "MSFT"]);
//   const live = prices["AAPL"]; // { price, timestamp } | undefined
//
// Gracefully disables if NEXT_PUBLIC_FINNHUB_API_KEY is not set.
//
// Security note: this key is shipped in the client bundle. That's OK for a
// personal/local dev app (Finnhub explicitly supports client-side tokens), but
// for a public deployment you'd want a server-side WebSocket proxy instead so
// the key never reaches the browser.

"use client";

import { useEffect, useRef, useState } from "react";

const API_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;

export type LivePrice = { price: number; timestamp: number };
export type LiveStatus = "disabled" | "connecting" | "connected" | "disconnected";

type TradeMessage = {
  type: "trade";
  data: Array<{ s: string; p: number; t: number; v?: number }>;
};

export function useLivePrices(tickers: string[]): {
  prices: Record<string, LivePrice>;
  status: LiveStatus;
} {
  const [prices, setPrices] = useState<Record<string, LivePrice>>({});
  const [status, setStatus] = useState<LiveStatus>(API_KEY ? "connecting" : "disabled");
  const wsRef = useRef<WebSocket | null>(null);
  const subscribedRef = useRef<Set<string>>(new Set());
  const tickersRef = useRef<string[]>(tickers);
  tickersRef.current = tickers;

  // Stable key for effect dependency so we only re-sync when the set changes.
  const tickersKey = [...tickers].sort().join(",");

  // Lifecycle: open + auto-reconnect.
  useEffect(() => {
    if (!API_KEY) return;

    let mounted = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = 1000;

    function syncSubscriptions() {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const desired = new Set(tickersRef.current);
      // Unsubscribe removed
      for (const s of Array.from(subscribedRef.current)) {
        if (!desired.has(s)) {
          ws.send(JSON.stringify({ type: "unsubscribe", symbol: s }));
          subscribedRef.current.delete(s);
        }
      }
      // Subscribe added
      for (const s of desired) {
        if (!subscribedRef.current.has(s)) {
          ws.send(JSON.stringify({ type: "subscribe", symbol: s }));
          subscribedRef.current.add(s);
        }
      }
    }

    function connect() {
      if (!mounted) return;
      setStatus("connecting");
      const ws = new WebSocket(`wss://ws.finnhub.io?token=${API_KEY}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mounted) return;
        setStatus("connected");
        reconnectDelay = 1000; // reset backoff
        subscribedRef.current.clear();
        syncSubscriptions();
      };

      ws.onmessage = (e: MessageEvent) => {
        if (!mounted) return;
        try {
          const msg = JSON.parse(e.data) as Partial<TradeMessage>;
          if (msg.type !== "trade" || !Array.isArray(msg.data)) return;

          // A single message may contain many trades; keep the latest per symbol.
          const updates: Record<string, LivePrice> = {};
          for (const t of msg.data) {
            if (t.s && typeof t.p === "number") {
              const existing = updates[t.s];
              if (!existing || t.t > existing.timestamp) {
                updates[t.s] = { price: t.p, timestamp: t.t };
              }
            }
          }
          if (Object.keys(updates).length > 0) {
            setPrices((prev) => ({ ...prev, ...updates }));
          }
        } catch {
          // Non-JSON or malformed message — ignore.
        }
      };

      ws.onclose = () => {
        if (!mounted) return;
        wsRef.current = null;
        subscribedRef.current.clear();
        setStatus("disconnected");
        // Exponential backoff, capped at 30s.
        reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
        reconnectTimer = setTimeout(connect, reconnectDelay);
      };
    }

    connect();

    return () => {
      mounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const ws = wsRef.current;
      if (ws) {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            for (const s of subscribedRef.current) {
              ws.send(JSON.stringify({ type: "unsubscribe", symbol: s }));
            }
          }
          ws.close();
        } catch {
          // ignore
        }
      }
      subscribedRef.current.clear();
    };
    // Intentionally empty deps — the connection lives for the hook's lifetime.
    // Subscription diffing is handled by a separate effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscription diff: when tickers change and we're already connected, just
  // send the delta — no reconnect needed.
  useEffect(() => {
    if (!API_KEY) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const desired = new Set(tickers);
    for (const s of Array.from(subscribedRef.current)) {
      if (!desired.has(s)) {
        ws.send(JSON.stringify({ type: "unsubscribe", symbol: s }));
        subscribedRef.current.delete(s);
      }
    }
    for (const s of desired) {
      if (!subscribedRef.current.has(s)) {
        ws.send(JSON.stringify({ type: "subscribe", symbol: s }));
        subscribedRef.current.add(s);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickersKey]);

  return { prices, status };
}
