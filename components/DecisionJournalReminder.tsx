// Dashboard banner that appears when one or more journal entries have hit
// their "re-check me in N months" date. Nudges the user to revisit their
// thesis. Dismissed for the current session by clicking the × (does not
// remove the entry — just hides this banner).

"use client";

import { useState } from "react";
import Link from "next/link";
import { useDecisionJournal } from "@/hooks/useDecisionJournal";

export default function DecisionJournalReminder() {
  const { dueForReview, hydrated } = useDecisionJournal();
  const [dismissed, setDismissed] = useState(false);

  if (!hydrated || dismissed || dueForReview.length === 0) return null;

  const first = dueForReview[0];
  const extra = dueForReview.length - 1;

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <span className="font-semibold">Time to revisit your thesis.</span>{" "}
        You asked to re-check <span className="font-mono">{first.ticker}</span>
        {extra > 0 && (
          <>
            {" "}
            and {extra} other{extra === 1 ? "" : "s"}
          </>
        )}
        . Compare what you wrote with what actually happened.{" "}
        <Link
          href="/decisions"
          className="underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-100"
        >
          Open my decisions →
        </Link>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="shrink-0 text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
      >
        ×
      </button>
    </div>
  );
}
