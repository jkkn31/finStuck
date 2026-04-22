// Diagnostic benchmark for local Ollama performance.
import OpenAI from "openai";

const MODEL = process.env.LLM_MODEL ?? "qwen3:14b";
const client = new OpenAI({ baseURL: "http://localhost:11434/v1", apiKey: "ollama", timeout: 600_000 });

async function run(label, req) {
  const t0 = Date.now();
  const resp = await client.chat.completions.create({ model: MODEL, ...req });
  const dt = (Date.now() - t0) / 1000;
  const tok = resp.usage?.completion_tokens ?? 0;
  const promptTok = resp.usage?.prompt_tokens ?? 0;
  const text = resp.choices[0].message.content ?? "";
  console.log(
    `[${label}] ${dt.toFixed(1)}s | prompt ${promptTok} tok | completion ${tok} tok | ${(tok / dt).toFixed(1)} tok/s`,
  );
  console.log("  preview:", text.replace(/\n/g, "\\n").slice(0, 120));
  console.log();
}

console.log(`Model: ${MODEL}\n`);

// 1. Tiny prompt, no JSON mode, no thinking
await run("tiny + no_think", {
  messages: [{ role: "user", content: "Say hello in one word. /no_think" }],
  max_tokens: 30,
});

// 2. Same but ask for JSON mode
await run("tiny + json_object", {
  messages: [{ role: "user", content: 'Return {"greeting":"hi"} only. /no_think' }],
  response_format: { type: "json_object" },
  max_tokens: 30,
});

// 3. Large prompt like our real fundamentals agent (no json mode)
const bigPrompt = `You score company fundamentals. Metrics:
P/E 33, PEG 2.1, revenue growth 5%, margin 27%, D/E 1.5.
Reply with JSON: {"verdict":"strong|neutral|weak","rationale":"..."} only. /no_think`;
await run("realistic prompt, no json mode", {
  messages: [{ role: "user", content: bigPrompt }],
  max_tokens: 200,
});

// 4. Realistic prompt WITH json mode
await run("realistic prompt, json mode", {
  messages: [{ role: "user", content: bigPrompt }],
  response_format: { type: "json_object" },
  max_tokens: 200,
});
