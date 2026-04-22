// localStorage-backed "has the user seen this tour?" flag. Null until
// hydration completes so we don't auto-launch before we know the true value.

"use client";

import { useCallback, useEffect, useState } from "react";

export function useTourSeen(id: string) {
  const key = `invest.tour.${id}.seen.v1`;
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setSeen(window.localStorage.getItem(key) === "1");
    } catch {
      setSeen(false);
    }
  }, [key]);

  const markSeen = useCallback(() => {
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // ignore (quota / private mode)
    }
    setSeen(true);
  }, [key]);

  return { seen, markSeen };
}
