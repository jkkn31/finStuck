# invest · multi-agent stock analysis for beginners

A Next.js web app that takes a ticker symbol and runs a team of LLM agents
to produce an educational, plain-English analysis: buy/hold/sell signal,
pre-buy checklist, time-machine backtest, and a decision journal the user
owns. Runs entirely on your laptop — no backend, no database, no account.

> **Educational use only. Not financial advice.** Signals are a summary of
> indicators and news, not predictions. Do your own research before
> investing.

---

## Features

### Multi-agent analysis (`/`)
- **Quote stage** — fail fast on invalid tickers (no LLM spend wasted on
  typos)
- **Fundamentals agent** — P/E, Forward P/E, PEG, EPS, margins, debt/equity
- **Technicals agent** — 5Y chart, SMA 50/200, RSI(14), MACD, 52-week
  hi/lo, volume trend
- **News & sentiment agent** — recent headlines, forward-looking plans,
  catalysts
- **Checklist agent** — 7-item pre-buy checklist (growth · profitability ·
  valuation · balance sheet · analyst view · sentiment · technical entry)
- **Orchestrator agent** — synthesizes the specialists into one signal
  (Strong Buy / Buy / Hold / Sell / Strong Sell), a 3-way market lean bar,
  and a plain-English "why this signal?" paragraph with 3–5 bullet reasons
- SSE streaming: per-stage progress events so the card shows what's happening
  instead of a blank spinner

### Time-machine backtest (on every analysis card)
"If you had bought \$X of this N years ago..." Uses the 5Y priceHistory
already on the payload plus a lazy SPY fetch. Shows:
- Worth today + total return
- Scariest drawdown window + recovery time
- Side-by-side vs SPY over the same period
- Optional "Pro view" → annualized CAGR, volatility, worst ~21-day return

### Decision journal (`/decisions`)
- Write your one-sentence thesis + what would change your mind
- Snapshot the signal, confidence, price, P/E at save time
- Re-check reminder after 1 / 3 / 6 months
- History view shows "since you wrote this" vs SPY delta so you can see
  if you were right
- Dashboard banner nudges when a re-check date hits

### Analysis history (`/history`)
- Every completed run auto-saves (cap 30, LRU) to `localStorage`
- Revisit any past analysis without re-spending LLM credits
- Sky-blue SnapshotBanner makes it clear the view is frozen, with one
  click to refresh against today's data

### My stocks (`/portfolio`)
- Track the stocks you own with ticker + shares + optional cost basis.
  All saved in `localStorage` — no broker connection, no account, no
  backend.
- Table shows current price, day change % and $, position value, and
  unrealized P&L (when cost basis is set). Footer totals the whole
  portfolio.
- **Portfolio agent** (one-click "Summarize my portfolio"): for each
  holding produces a single-sentence "why it moved today" plus the 2-3
  most relevant recent headlines. Pre-fetches all quote + news data so
  the LLM is a pure synthesizer — fast, deterministic, no tool-use.
- Click any ticker in the table to jump to the full multi-agent
  analysis.

### Screener (`/screener`)
- Top 25 movers among the 100 largest S&P 500 names, ranked by **1D / 1W
  / 1M / YTD / 1Y** return. Toggle between gainers and losers.
- Each row gets a **health badge** — green ✓ if it passes all four
  short-term quality checks, amber ⚠ otherwise (tooltip lists the exact
  failures so you learn what each signal means):
  1. Price above the 50-day moving average (established uptrend)
  2. RSI between 30 and 70 (not overbought or oversold)
  3. Volume rising vs the prior 20 days (conviction behind the move)
  4. Company is TTM-profitable (basic zombie filter)
- Next-earnings-date column: red badge if ≤7 days, amber if ≤30 days.
- One click "Analyze" on any row deep-links into the dashboard with that
  ticker pre-populated and the full multi-agent analysis running.

### Guided tour
- Auto-launches on first visit (welcome tour)
- Second tour walks through an analysis card (signal → chart → stats →
  fundamentals → time-machine → checklist → why → agents → journal)
- "Guide me" button to replay
- `localStorage`-backed seen flag so it doesn't nag twice

### Glossary hovers + beginner-shaped copy
- Dotted-underline labels on jargon (P/E, PEG, SMA, RSI, drawdown, etc.)
  with inline plain-English definitions on hover
- Every LLM prompt instructs models to write like explaining to a smart
  friend, not a finance textbook

### Conversational Educator (bottom-right chat button)
- True tool-use loop: the model decides when to call `get_quote`,
  `get_fundamentals`, `get_technical_snapshot`, `get_news`
- Answers "what is a P/E ratio?", "why is MSFT down today?", "is NVDA
  overvalued?" in a streaming chat panel

### Live prices (optional)
- Plug in a free Finnhub key and each card's header price + change %
  updates on every real trade tick. Otherwise cards show the delayed
  Yahoo snapshot.

---

## Architecture

```
Next.js 16 (App Router, TypeScript, Turbopack)
├─ app/
│  ├─ page.tsx                     — dashboard hero + streaming cards
│  ├─ layout.tsx                   — header nav, disclaimer banner
│  ├─ stock/[ticker]/page.tsx      — detail route (also inlined on card)
│  ├─ decisions/page.tsx           — your saved theses + deltas vs SPY
│  ├─ history/page.tsx             — past analyses (localStorage)
│  ├─ portfolio/page.tsx           — "My stocks" + daily agent briefing
│  ├─ screener/page.tsx            — top movers + health badges (S&P 100)
│  └─ api/
│     ├─ analyze/route.ts          — POST tickers, SSE stream
│     ├─ chat/route.ts             — Educator SSE (text + tool-calls)
│     ├─ history/[ticker]/route.ts — intraday bars for 1D/1W chart
│     ├─ benchmark/[ticker]/route.ts — SPY history for the time-machine
│     ├─ quotes/route.ts           — batch quote lookup for portfolio
│     ├─ portfolio/summarize/route.ts — SSE stream of the portfolio agent
│     └─ screener/route.ts         — top-100 S&P screening, SSE stream
├─ lib/
│  ├─ agents/
│  │  ├─ llm.ts                    — OpenAI-compatible client + zod helper
│  │  ├─ fundamentals.ts           — specialist
│  │  ├─ technicals.ts             — specialist
│  │  ├─ news.ts                   — specialist
│  │  ├─ checklist.ts              — 7-item pre-buy checklist specialist
│  │  ├─ orchestrator.ts           — runs agents in parallel, synthesizes
│  │  ├─ portfolio.ts              — daily briefing on user's holdings
│  │  └─ educator.ts               — conversational tool-use agent
│  ├─ tools/
│  │  ├─ yahoo.ts                  — yahoo-finance2 wrapper (cached)
│  │  ├─ indicators.ts             — pure SMA / EMA / RSI / MACD
│  │  └─ cache.ts                  — tiny in-memory TTL cache
│  ├─ backtest.ts                  — pure-math time-machine calculations
│  ├─ screener.ts                  — top-100 universe, health baseline,
│  │                                 period-return + YTD helpers
│  ├─ schemas.ts                   — zod schemas for every agent output
│  ├─ tours.ts                     — step definitions for guided tour
│  ├─ sp500.ts / sp500.json        — ticker autocomplete list
│  └─ disclaimer.ts                — shared "not advice" string
├─ hooks/
│  ├─ useLivePrices.ts             — Finnhub WebSocket
│  ├─ useRecentTickers.ts          — MRU chips (localStorage)
│  ├─ useTourSeen.ts               — per-tour seen flag
│  ├─ useAnalysisHistory.ts        — /history CRUD (localStorage)
│  ├─ useBenchmarkHistory.ts       — SPY fetch + session cache
│  ├─ usePortfolio.ts              — /portfolio holdings (localStorage)
│  └─ useDecisionJournal.ts        — /decisions CRUD (localStorage)
└─ components/
   ├─ TickerDashboard.tsx          — hero, streaming grid, URL sync
   ├─ DetailedStockCard.tsx        — the big inline analysis card
   ├─ PriceChart.tsx               — lightweight-charts with SMA overlays
   ├─ ProgressCard.tsx             — 6-stage streaming UI
   ├─ SignalBadge.tsx / SignalBar.tsx
   ├─ ChecklistSection.tsx
   ├─ TimeMachineBacktest.tsx
   ├─ DecisionJournalForm.tsx / DecisionJournalReminder.tsx
   ├─ SnapshotBanner.tsx           — "viewing a saved analysis" banner
   ├─ ScreenerTable.tsx            — movers table + health badges
   ├─ PortfolioTable.tsx           — holdings + P&L + totals footer
   ├─ AddHoldingForm.tsx           — add/edit holding form
   ├─ PortfolioSummaryPanel.tsx    — Portfolio agent briefing view
   ├─ GlossaryLabel.tsx            — hover-tooltip jargon underliner
   ├─ GuidedTour.tsx               — overlay + spotlight + tooltips
   ├─ EducatorNudge.tsx / ChatPanel.tsx — floating educator
   ├─ CommandPalette.tsx           — ⌘K jump between tickers
   ├─ TickerAutocomplete.tsx / RecentTickersBar.tsx
   ├─ LivePricePill.tsx
   └─ ThemeProvider.tsx / ThemeToggle.tsx
```

### Why multi-agent?
Each specialist sees only what it needs and produces a small, zod-validated
JSON finding. The orchestrator reads **only the three summaries** — no raw
data — which keeps its context small and its verdict explainable ("Buy
because fundamentals=strong, technicals=neutral, news=positive").

### Safety design
- **No real trades.** The app doesn't talk to any broker.
- **No real financial advice.** System prompts frame output as educational;
  every card + response carries a disclaimer.
- **All user data stays in the browser.** Recent tickers, analysis history,
  decision journal, tour-seen flags — everything lives in `localStorage` /
  `sessionStorage`. There is no backend database.
- **News headline text is treated as untrusted input**: agent prompts
  instruct models to ignore embedded instructions.

---

## Setup

For production deploy to Vercel (Hobby free tier works), see
[`DEPLOY.md`](DEPLOY.md). The rest of this section covers local
development.

### 1. Prerequisites
- Node.js 20+
- An OpenAI-compatible LLM endpoint — defaults to **Ollama running locally**
  (free, no API key)

### 2. Install

```bash
git clone https://github.com/Rmaram07/stock-analysis.git invest
cd invest
npm install
```

### 3. (Optional) Live prices via Finnhub

Yahoo data is "near-real-time" (officially up to 15 min delayed). To get a
**true real-time stream** with a green "● Live" pill on each card:

1. Free signup at https://finnhub.io → get an API key
2. Add to `.env.local`:

```bash
NEXT_PUBLIC_FINNHUB_API_KEY=your-finnhub-key
```

Skip and the app still works — cards show the delayed Yahoo quote with a
grey "○ Delayed" pill.

> `NEXT_PUBLIC_` vars ship in the client bundle. Fine for a local/personal
> app (Finnhub explicitly supports client-side tokens).

### 4. Pick an LLM backend

The app talks to any **OpenAI-compatible** chat-completions endpoint.

#### Option A — Ollama locally (default, zero keys, zero cost)

```bash
# macOS
brew install ollama
ollama serve &               # starts the local server on :11434
ollama pull qwen3:14b        # ~9 GB download, one-time
# smaller alternatives: qwen3:8b, qwen3:4b — much faster on ≤16 GB RAM
```

No `.env.local` needed — the defaults
(`http://localhost:11434/v1`, model `qwen3:14b`) just work.

| RAM | Recommended model | Notes |
|---|---|---|
| 8 GB | `qwen3:4b` | `LLM_MODEL=qwen3:4b` in `.env.local` |
| 16 GB | `qwen3:8b` | `LLM_MODEL=qwen3:8b` |
| 24 GB | `qwen3:14b` (default) | `LLM_CONCURRENCY=1` if slow |
| 32 GB+ | `qwen3:14b` or larger | `LLM_CONCURRENCY=3` for faster dashboard |

**If you see "Request timed out":**
- Try a smaller model: `LLM_MODEL=qwen3:8b`
- Lower concurrency: `LLM_CONCURRENCY=1`
- Raise per-call timeout: `LLM_TIMEOUT_MS=300000` (5 min)
- Let Ollama handle more parallel requests: `OLLAMA_NUM_PARALLEL=4 ollama serve`

#### Option B — OpenRouter (paid, any open-source or frontier model)

```bash
# .env.local
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=sk-or-v1-...
LLM_MODEL=qwen/qwen3-235b-a22b-2507
LLM_CONCURRENCY=4
LLM_TIMEOUT_MS=90000
```

Recommended for a snappy UX — 4-agent runs finish in ~15-25 s on
`qwen/qwen3-235b-a22b-2507` (~\$0.08 per million tokens blended).

#### Option C — DeepSeek, Groq, or any other OpenAI-compatible endpoint

Same shape — just swap `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`.
See [`lib/agents/llm.ts`](lib/agents/llm.ts) for details.

### 5. Run

```bash
npm run dev
# http://localhost:3000
```

### Notes on "thinking" models
Qwen3 and DeepSeek-R1 emit `<think>...</think>` blocks by default. The LLM
client in [`lib/agents/llm.ts`](lib/agents/llm.ts) appends `/no_think` to
suppress them for structured JSON output (3-5× speedup) and strips any
leaked blocks before parsing.

### 6. Smoke test (optional)

```bash
node scripts/smoke.mjs
# Prints live AAPL quote, P/E, last 5 daily closes, and 3 news headlines.
```

---

## Usage walkthrough

1. Open `http://localhost:3000` — the welcome tour auto-launches.
2. Type `META` (or any ticker) and click **Analyze**. Cards stream in.
3. Scroll the card: 5Y chart → market-lean bar → stats → **key
   fundamentals** (P/E, Forward P/E, PEG, EPS, Revenue Growth, Profit
   Margin) → **time-machine** ("if you'd bought \$100 5Y ago...") →
   7-item pre-buy checklist → "why this signal?" → per-agent breakdown
   → "what's next" with forward plans + catalysts + headlines.
4. Write a one-sentence thesis in **Own your decision** at the bottom.
   Open `/decisions` in a few months to see how you did.
5. **History** nav link (top) → list of every past analysis, one-click
   revisit without re-spending LLM credits.
6. **Screener** nav link (top) → top 25 movers in the S&P top 100 for
   your chosen period (1D / 1W / 1M / YTD / 1Y), with green-check or
   amber-warn health badges on each row. Click **Analyze** on any row
   to drop that ticker into the dashboard.
7. **My stocks** nav link → add tickers + shares + optional cost
   basis. Table shows day change $ / %, position value, and unrealized
   P&L. Edit any row in place with the inline **Edit** button. Click
   **Summarize my portfolio** for a one-click daily briefing from the
   Portfolio agent (per-stock "why it moved today" + top 2-3 headlines).
8. Click **Ask Educator** (bottom-right) for "what is RSI?",
   "why is NVDA down today?", "is this expensive?".

---

## What's out of scope (by design)

- Real trade execution (Alpaca / IBKR / Robinhood)
- Real fractional share purchases
- Personalized "you should buy X" recommendations based on your actual
  finances
- Cross-device sync (everything is browser-local on purpose)

---

## Data sources

- **Prices, fundamentals, news:**
  [yahoo-finance2](https://github.com/gadicc/yahoo-finance2) (unofficial
  Yahoo Finance). Data is delayed and not guaranteed accurate.
- **LLM reasoning:** any OpenAI-compatible endpoint (Ollama by default).

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, TypeScript) |
| LLM | `openai` SDK pointed at any OpenAI-compatible endpoint |
| Market data | `yahoo-finance2` |
| Indicators | Pure TypeScript (`lib/tools/indicators.ts`) |
| Backtest math | Pure TypeScript (`lib/backtest.ts`) |
| Validation | `zod` |
| User data | Browser `localStorage` / `sessionStorage` |
| Price charts | `lightweight-charts` |
| UI | Tailwind CSS v4 |
| Streaming | Server-Sent Events |
