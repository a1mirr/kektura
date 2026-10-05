"use client";

import dynamic from "next/dynamic";
import type { MapExtra, MapPoint } from "./TrailMap";

// MapLibre needs the browser (WebGL), so it is never rendered on the server.
const TrailMap = dynamic(() => import("./TrailMap"), {
  ssr: false,
  loading: () => <div className="h-96 w-full animate-pulse rounded-lg bg-stone-100" />,
});

export default function TrailMapLoader({
  points,
  extras,
  doneRanges,
  withRestaurants,
}: {
  points: MapPoint[];
  extras: MapExtra[];
  doneRanges: [number, number][];
  withRestaurants: boolean;
}) {
  return <TrailMap points={points} extras={extras} doneRanges={doneRanges} withRestaurants={withRestaurants} />;
}
