import { DONE } from "@/lib/map-layers";
import type { KmRange } from "@/lib/progress";
import { shareMapPaths } from "@/lib/share-card";
import { TRAIL_ROUTE } from "@/lib/share-route";

const TODO = "#d6d3d1";
const END = "#78716c";

export default function ShareMap({ ranges, label }: { ranges: KmRange[]; label: string }) {
  const map = shareMapPaths(TRAIL_ROUTE, ranges, 560);
  return (
    <svg viewBox={`0 0 ${map.width} ${map.height}`} role="img" aria-label={label} className="mx-auto h-auto w-full max-w-md">
      <path d={map.trail} fill="none" stroke={TODO} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      {map.walked && <path d={map.walked} fill="none" stroke={DONE} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />}
      <circle cx={map.start[0]} cy={map.start[1]} r={6} fill="#ffffff" stroke={END} strokeWidth={3} />
      <circle cx={map.end[0]} cy={map.end[1]} r={6} fill="#ffffff" stroke={END} strokeWidth={3} />
    </svg>
  );
}
