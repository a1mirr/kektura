import { sliceRoute, type Route } from "./route-geometry";
import {
  countDone,
  progressSummary,
  walkedRanges,
  type KmRange,
  type Place,
  type Stage,
} from "./progress";

export const SHARE_CARD_LIMIT = 20;

const SHARE_TOKEN = /^[0-9a-f]{32}$/;
export const isShareToken = (value: string): boolean => SHARE_TOKEN.test(value);

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
  createdAt: string;
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

export const shareUrl = (origin: string, locale: string, token: string): string => `${origin}/${locale}/share/${token}`;

export const telegramShareUrl = (url: string, text: string): string =>
  `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

export type ShareMapPaths = {
  width: number;
  height: number;
  trail: string;
  walked: string;
  start: [number, number];
  end: [number, number];
};

const PADDING = 12;
const MIN_STEP = 1.5; // px: a vertex closer than this to the last kept one adds nothing visible

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
