import { analyzeStock } from "@/lib/agents/orchestrator";
import { technicalsForChart } from "@/lib/agents/technicals";
import DetailHero from "@/components/DetailHero";
import ChecklistSection from "@/components/ChecklistSection";
import EducatorNudge from "@/components/EducatorNudge";
import { DISCLAIMER } from "@/lib/disclaimer";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { ticker: string };

export default async function StockPage({ params }: { params: Promise<Params> }) {
  const { ticker } = await params;
  const t = ticker.toUpperCase();

  let analysis, chart;
  try {
    [analysis, chart] = await Promise.all([analyzeStock(t), technicalsForChart(t)]);
  } catch {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header + chart + signal bar + stats — all in a client component so
          the header percentage tracks the chart's selected time range. */}
      <DetailHero analysis={analysis} chart={chart} />

      <EducatorNudge />

      {/* Pre-buy checklist — placed before "Why this signal?" so the concrete
          pass/warn/fail items frame the synthesized rationale below. */}
      <ChecklistSection checklist={analysis.checklist} />

      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <h2 className="font-semibold mb-2">Why this signal?</h2>
        <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-3">{analysis.signal.beginnerExplanation}</p>
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <Finding title="Fundamentals" verdict={analysis.fundamentals.verdict} rationale={analysis.fundamentals.rationale} />
          <Finding title="Technicals" verdict={analysis.technicals.verdict} rationale={analysis.technicals.rationale} />
          <Finding title="News / Sentiment" verdict={analysis.news.verdict} rationale={analysis.news.rationale} />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <h2 className="font-semibold">What&apos;s next for this company</h2>
        <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">{analysis.news.forwardPlans}</p>
        {analysis.news.catalysts.length > 0 && (
          <>
            <h3 className="text-xs uppercase tracking-wide text-zinc-500 mt-3">Watch for</h3>
            <ul className="list-disc ml-5 text-sm text-zinc-700 dark:text-zinc-300">
              {analysis.news.catalysts.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </>
        )}
        {analysis.news.headlines.length > 0 && (
          <>
            <h3 className="text-xs uppercase tracking-wide text-zinc-500 mt-3">Recent headlines</h3>
            <ul className="text-sm space-y-1">
              {analysis.news.headlines.map((h, i) => (
                <li key={i}>
                  <a href={h.link} target="_blank" rel="noreferrer" className="hover:underline">
                    {h.title}
                  </a>
                  <span className="text-zinc-500"> — {h.publisher}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <p className="text-xs text-zinc-500">{DISCLAIMER}</p>
    </div>
  );
}

function Finding({
  title,
  verdict,
  rationale,
}: {
  title: string;
  verdict: "strong" | "neutral" | "weak";
  rationale: string;
}) {
  const color =
    verdict === "strong"
      ? "text-emerald-600"
      : verdict === "weak"
      ? "text-rose-600"
      : "text-zinc-500";
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold">{title}</span>
        <span className={`font-semibold ${color}`}>{verdict}</span>
      </div>
      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{rationale}</p>
    </div>
  );
}

