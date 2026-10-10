// One hop between neighbouring stamping places: length km, ascent/descent m when walking west->east,
// time in minutes forward/back (null for the Visegrád-Nagymaros ferry).
export type Hop = {
  a: string;
  b: string;
  km: number;
  up: number;
  down: number;
  tf: number | null;
  tb: number | null;
  ferry?: boolean;
};

export type RouteStats = { km: number; up: number; down: number; minutes: number; ferry: boolean };

// place_key -> position along the hop chain (0 = Írott-kő).
export function hopOrder(hops: Hop[]): Map<string, number> {
  const order = new Map<string, number>();
  if (hops.length) order.set(hops[0].a, 0);
  hops.forEach((h, k) => order.set(h.b, k + 1));
  return order;
}

// Sum the hops between two places. Walking east->west swaps ascent and descent and uses the "back"
// times. Null when either place is unknown or both are the same.
export function routeStats(hops: Hop[], order: Map<string, number>, from: string, to: string): RouteStats | null {
  const i = order.get(from);
  const j = order.get(to);
  if (i === undefined || j === undefined || i === j) return null;
  const forward = i < j;
  const stats: RouteStats = { km: 0, up: 0, down: 0, minutes: 0, ferry: false };
  for (let k = Math.min(i, j); k < Math.max(i, j); k++) {
    const h = hops[k];
    stats.km += h.km;
    stats.up += forward ? h.up : h.down;
    stats.down += forward ? h.down : h.up;
    const minutes = forward ? h.tf : h.tb;
    if (h.ferry || minutes === null) stats.ferry = true;
    else stats.minutes += minutes;
  }
  stats.km = Math.round(stats.km * 10) / 10;
  return stats;
}

export const fmtTime = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
