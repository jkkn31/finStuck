// Banner pointing users at the Educator chat. Shown on the hero (empty
// state) and above each stock card's rationale so a beginner who sees
// unfamiliar terms has an obvious next step.
//
// Two variants:
//  - "hero":   larger, two-tone emerald gradient, arrow pointing to chat button
//  - "inline": slightly smaller but still prominent; rendered inside cards

export default function EducatorNudge({ variant = "inline" }: { variant?: "hero" | "inline" }) {
  const isHero = variant === "hero";

  return (
    <div
      className={[
        "flex items-center gap-3 rounded-xl border shadow-sm",
        "border-emerald-300/70 dark:border-emerald-800",
        "bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40",
        "text-emerald-900 dark:text-emerald-100",
        isHero ? "px-5 py-3.5 text-sm" : "px-4 py-3 text-sm",
      ].join(" ")}
    >
      <span
        className={
          isHero
            ? "text-2xl shrink-0"
            : "text-xl shrink-0"
        }
        aria-hidden
      >
        💡
      </span>
      <div className="flex-1 leading-snug">
        <div className="font-semibold">
          New to investing? Don&apos;t let jargon slow you down.
        </div>
        <div className="text-emerald-800/90 dark:text-emerald-200/90 mt-0.5">
          Tap the{" "}
          <span className="inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded-md bg-emerald-600 text-white font-semibold text-xs align-baseline">
            Ask Educator
          </span>{" "}
          button (bottom-right) — it explains any term or metric in plain English.
        </div>
      </div>
      <span
        className="text-2xl shrink-0 text-emerald-600 dark:text-emerald-300 animate-bounce-slow"
        aria-hidden
      >
        ↘
      </span>
    </div>
  );
}
