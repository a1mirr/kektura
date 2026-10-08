// Share cards (spec 0039): a frozen snapshot of a user's progress behind a public link. Pure functions: what a card
// holds, how its link is written, and how the trail is drawn from the walked ranges. The database rules are in
// `supabase/migrations/0132_share_cards.sql`, the page and the image read a card and call these.
import { sliceRoute, type Route } from "./route-geometry";
import {
  countDone,
  progressSummary,
  walkedRanges,
  type KmRange,
  type Place,
  type Stage,
} from "./progress";

// A user keeps at most this many cards (the same number is enforced in `create_share_card`).
export const SHARE_CARD_LIMIT = 20;

// The token of a card: 128 random bits as hex, the format the database enforces.
const SHARE_TOKEN = /^[0-9a-f]{32}$/;
export const isShareToken = (value: string): boolean => SHARE_TOKEN.test(value);

// What a card freezes. No stamp, no date, no note: only totals and the walked stretches.
export type ShareSnapshot = {
  stampsDone: number;
  stampsTotal: number;
  percent: number;
  kmDone: number;
  kmLeft: number;
  stagesDone: number;
  stagesTotal: number;
  ranges: KmRange[];
};

// The numbers of the dashboard and the stats page (spec 0001, spec 0037 AC-3), from the same functions, so a card never
// disagrees with them.
export function buildShareSnapshot(
  places: Place[],
  stages: Stage[],
  stamped: ReadonlyMap<string, string>,
  waived: ReadonlySet<string>,
): ShareSnapshot {
  const ranges = walkedRanges(places, stamped, waived);
  const summary = progressSummary(places, ranges);
  return {
    stampsDone: stamped.size,
    stampsTotal: places.length,
    percent: summary.percent,
    kmDone: summary.doneKm,
    kmLeft: summary.remainingKm,
    stagesDone: stages.filter((stage) => countDone(stage.places, stamped, waived) === stage.places.length).length,
    stagesTotal: stages.length,
    ranges,
  };
}

// One card as `get_share_card` returns it (numbers arrive as numbers or, for `numeric`, as numbers too through PostgREST).
export type ShareCardRow = {
  created_at: string;
  display_name: string | null;
  stamps_done: number;
  stamps_total: number;
  percent: number;
  km_done: number;
  km_left: number;
  stages_done: number;
  stages_total: number;
  ranges: unknown;
};

export type ShareCard = {
  createdAt: string; // ISO timestamp
  name: string | null;
  stampsDone: number;
  stampsTotal: number;
  percent: number;
  kmDone: number;
  kmLeft: number;
  stagesDone: number;
  stagesTotal: number;
  ranges: KmRange[];
};

// `ranges` is jsonb, so it is checked here instead of trusted: anything but [from, to] number pairs is dropped.
export function parseRanges(value: unknown): KmRange[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((pair): KmRange[] =>
    Array.isArray(pair) && pair.length === 2 && typeof pair[0] === "number" && typeof pair[1] === "number" && pair[0] < pair[1]
      ? [[pair[0], pair[1]]]
      : [],
  );
}

export function toShareCard(row: ShareCardRow): ShareCard {
  return {
    createdAt: row.created_at,
    name: row.display_name,
    stampsDone: row.stamps_done,
    stampsTotal: row.stamps_total,
    percent: row.percent,
    kmDone: Number(row.km_done),
    kmLeft: Number(row.km_left),
    stagesDone: row.stages_done,
    stagesTotal: row.stages_total,
    ranges: parseRanges(row.ranges),
  };
}

// The public address of a card: `/<locale>/share/<token>`. The language is the one the link is opened in.
export const shareUrl = (origin: string, locale: string, token: string): string => `${origin}/${locale}/share/${token}`;

// Telegram's own share dialog (spec 0039 AC-9): opens with the link and a line of text to send.
export const telegramShareUrl = (url: string, text: string): string =>
  `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

// ---- The map -------------------------------------------------------------------------------------------------------

export type ShareMapPaths = {
  width: number;
  height: number;
  // `d` of the whole trail and of the walked stretches (separate sub-paths); empty when there is nothing to draw.
  trail: string;
  walked: string;
  start: [number, number];
  end: [number, number];
};

const PADDING = 12;
const MIN_STEP = 1.5; // px: a vertex closer than this to the last kept one adds nothing visible

// The trail and the walked stretches as SVG paths in a box `width` wide (the height follows the trail's shape).
// Longitude is scaled by the cosine of the middle latitude, so Hungary is not stretched sideways.
export function shareMapPaths(route: Route, ranges: KmRange[], width: number): ShareMapPaths {
  const points = route.points;
  if (points.length < 2) return { width, height: 0, trail: "", walked: "", start: [0, 0], end: [0, 0] };
  const lats = points.map((p) => p[1]);
  const lngs = points.map((p) => p[0]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const scaleX = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = (Math.max(...lngs) - minLng) * scaleX;
  const spanY = maxLat - minLat;
  const scale = (width - 2 * PADDING) / spanX;
  const height = Math.round(spanY * scale + 2 * PADDING);
  const project = ([lng, lat]: [number, number]): [number, number] => [
    Math.round((PADDING + (lng - minLng) * scaleX * scale) * 10) / 10,
    Math.round((PADDING + (maxLat - lat) * scale) * 10) / 10,
  ];

  // Keeps the first and the last vertex and every vertex that moved at least MIN_STEP from the last one kept.
  const thin = (line: [number, number][]): [number, number][] => {
    const kept: [number, number][] = [];
    line.forEach((point, i) => {
      const last = kept[kept.length - 1];
      if (!last || i === line.length - 1 || Math.hypot(point[0] - last[0], point[1] - last[1]) >= MIN_STEP) kept.push(point);
    });
    return kept;
  };
  const toPath = (line: [number, number][]) => `M${thin(line).map(([x, y]) => `${x} ${y}`).join("L")}`;
  const lineOf = (from: number, to: number) => sliceRoute(route, from, to).map((p) => project(p));

  const last = points[points.length - 1];
  return {
    width,
    height,
    trail: toPath(points.map((p) => project([p[0], p[1]]))),
    walked: ranges.map(([from, to]) => toPath(lineOf(from, to))).join(""),
    start: project([points[0][0], points[0][1]]),
    end: project([last[0], last[1]]),
  };
}
