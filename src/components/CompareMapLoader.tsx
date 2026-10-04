"use client";

import dynamic from "next/dynamic";
import type { ComparisonRanges } from "@/lib/compare";
import type { ComparePoint } from "@/lib/compare-map";

// MapLibre needs the browser (WebGL), so it is never rendered on the server.
const CompareMap = dynamic(() => import("./CompareMap"), {
  ssr: false,
  loading: () => <div className="h-80 w-full animate-pulse rounded-lg bg-stone-100 sm:h-96" />,
});

export default function CompareMapLoader({ points, ranges }: { points: ComparePoint[]; ranges: ComparisonRanges }) {
  return <CompareMap points={points} ranges={ranges} />;
}
