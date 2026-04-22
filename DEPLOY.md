# Deploying to Vercel

This app is set up for Vercel Hobby (free) tier. Takes ~5 minutes.

## What's already wired for Vercel

- [`vercel.json`](vercel.json) sets `maxDuration: 60` on the routes that
  stream LLM output (`/api/analyze`, `/api/chat`), fetch many upstream
  items (`/api/screener`), or render a detail page server-side
  (`/stock/[ticker]`). Hobby's default per-function cap is 10 s, which
  isn't enough for the multi-agent analysis pipeline.
- All API routes use `runtime = "nodejs"` because `yahoo-finance2`
  depends on Node APIs. The Edge runtime would fail at cold start.
- SSE streams include anti-buffering padding
  ([`app/api/analyze/route.ts`](app/api/analyze/route.ts)) so Vercel's
  edge proxy flushes events immediately instead of waiting for a full
  buffer. Same pattern in `/api/chat` and `/api/screener`.

## Prerequisites

1. **GitHub repo** — code on GitHub (or GitLab / Bitbucket). This repo
   lives at `https://github.com/Rmaram07/stock-analysis`.
2. **OpenRouter key** — https://openrouter.ai/keys (required).
3. **Finnhub key** — https://finnhub.io (optional, for live prices).
4. **Vercel account** — https://vercel.com (sign up with GitHub).

## 1. Import the repo into Vercel

1. Log into Vercel → **Add New → Project**.
2. Select your GitHub org, pick the `stock-analysis` repo.
3. Vercel auto-detects Next.js — accept the defaults:
   - Framework: **Next.js**
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

## 2. Environment variables

Expand the **Environment Variables** section before clicking Deploy:

### Required

| Name | Value | Scope |
|---|---|---|
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1` | Production, Preview, Development |
| `LLM_API_KEY` | `sk-or-v1-...your-openrouter-key...` | Production, Preview, Development |
| `LLM_MODEL` | `qwen/qwen3-235b-a22b-2507` | Production, Preview, Development |
| `LLM_CONCURRENCY` | `4` | Production, Preview, Development |
| `LLM_TIMEOUT_MS` | `45000` | Production, Preview, Development |

> **Why 45000 ms?** Hobby's per-function limit is 60 s. Our client-side
> timeout has to be strictly less so we fail with a helpful message
> instead of getting abruptly killed by Vercel. If you upgrade to Pro
> (300 s cap), you can raise this to `90000`.

### Optional (live prices)

| Name | Value |
|---|---|
| `NEXT_PUBLIC_FINNHUB_API_KEY` | `your-finnhub-key` |

⚠️ `NEXT_PUBLIC_*` vars ship in the browser bundle. Fine for Finnhub
(they support client tokens for WebSocket auth). **Never** do this with
the OpenRouter key.

## 3. Deploy

Click **Deploy**. First build takes ~3 minutes. You'll land on
`https://your-repo.vercel.app`.

## 4. Verify

Open the URL and walk through the features:

| Behavior | Status |
|---|---|
| Dashboard loads, welcome tour auto-launches | ✅ |
| Type a ticker, autocomplete works | ✅ |
| Click Analyze → 6-stage SSE progress streams | ✅ |
| Card appears with chart, market-lean, stats, fundamentals | ✅ |
| Time-machine backtest shows vs SPY | ✅ |
| Pre-buy checklist renders all 7 items | ✅ |
| "Why this signal?" + per-agent findings | ✅ |
| Decision journal saves (check `/decisions`) | ✅ (localStorage) |
| Analysis history lists the run (check `/history`) | ✅ (localStorage) |
| Screener loads top 25 movers (check `/screener`) | ✅ (30-60 s cold) |
| Ask Educator (bottom-right) streams a reply | ✅ |
| Live price pill is green if Finnhub key set + market open | ✅ |

## Known Hobby limits

- **60-second per-function cap.** A 4-agent analysis usually finishes in
  10–30 s on `qwen/qwen3-235b-a22b-2507`. If you hit 60 s, the card
  surfaces a friendly timeout; the server still charged no LLM cost for
  the aborted request. Upgrade to Pro ($20/mo) to raise this to 300 s.
- **Screener cold start** — fetching 100 Yahoo summaries takes 30–60 s
  on a cold function instance. Subsequent runs within a few minutes are
  near-instant thanks to the in-memory cache.
- **No persistent storage.** All user data (recent tickers, decision
  journal, analysis history, tour seen flags) lives in `localStorage` /
  `sessionStorage`. That's intentional — keeps the app stateless so it
  fits the serverless model without a database.
- **~3-second cold start** on first hit after idle. Subsequent requests
  warm up.

## Troubleshooting

### "Auth failed against https://openrouter.ai/api/v1"
Wrong `LLM_API_KEY` or a `:free` suffix accidentally added to the
`LLM_MODEL`. Paid model should be exactly
`qwen/qwen3-235b-a22b-2507` (no `:free`).

### "Rate-limited by https://openrouter.ai/api/v1"
OpenRouter free tier exhausted. Either wait a minute, or add $5 of
credit at https://openrouter.ai/credits. $5 ≈ 15,000 analyses on
`qwen3-235b-a22b-2507`.

### "LLM call timed out after 45s"
Occasional OpenRouter provider slow-down. Retry the analysis — usually
fine on the next attempt. Pro tier fixes this permanently (300 s cap,
so `LLM_TIMEOUT_MS=90000` comfortably).

### "Model did not return JSON" with Chinese / Cyrillic characters
Qwen sampling glitch. Already guarded in `lib/agents/llm.ts` — the
analyze route retries automatically and the system prompt now forbids
non-English output, so this should be rare. If it's persistent, swap
`LLM_MODEL` to `openai/gpt-oss-120b` via env var; no code change needed.

### Ticker autocomplete missing a symbol
The autocomplete list is the S&P 500 (503 symbols) from
`lib/sp500.json`. For other exchanges / ETFs / ADRs, just type the
ticker — the analyze endpoint accepts any Yahoo-recognized symbol even
without a suggestion.

### Live price shows "Waiting for tick" forever
Finnhub is a trade feed, not a quote feed — it only emits when trades
print on the exchange. US markets are open 9:30 AM – 4:00 PM ET,
Monday–Friday. Outside those hours the pill stays amber and the card
shows the delayed Yahoo snapshot.

### Screener page is empty
First load always takes 30–60 s. Watch the `loaded X/100` counter on
the page. If it stalls past 60 s, Vercel killed the function —
refresh to retry, and the cached tickers (from partial prior run)
resolve instantly so the next attempt usually completes.

## Redeploying after changes

Every push to `main` triggers a new deploy automatically (Vercel watches
the repo). Preview deploys for non-`main` branches ship to a separate
preview URL.

```bash
git add -A
git commit -m "whatever"
git push
# Vercel deploys in ~2-3 minutes
```

## Rolling back

Vercel keeps every deploy. To revert:

1. Vercel dashboard → **Deployments** tab.
2. Find the prior green deploy → click the `•••` menu → **Promote to
   Production**.

Takes ~30 seconds, zero downtime.
