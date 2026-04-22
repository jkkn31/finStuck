import { Suspense } from "react";
import TickerDashboard from "@/components/TickerDashboard";

export default function Home() {
  // Suspense boundary is required because TickerDashboard uses
  // useSearchParams() (reactive URL sync). Without it, Next.js opts the
  // whole page out of static rendering with a build-time warning.
  return (
    <Suspense>
      <TickerDashboard />
    </Suspense>
  );
}
