import { describe, expect, it } from "vitest";
import {
  buildShareSnapshot,
  isShareToken,
  parseRanges,
  shareMapPaths,
  shareUrl,
  telegramShareUrl,
  toShareCard,
  type ShareCardRow,
} from "./share-card";
import type { Place, Stage } from "./progress";
import type { Route } from "./route-geometry";

const place = (key: string, km: number, stage: number): Place => ({
  key,
  seq: km,
  stage,
  label: key,
  name: key,
  km,
  requiredFrom: null,
  variants: [],
});

const places = [place("a", 0, 1), place("b", 10, 1), place("c", 20, 2), place("d", 40, 2)];
const stages: Stage[] = [
  { stage: 1, meta: undefined, places: places.slice(0, 2), startKey: null },
  { stage: 2, meta: undefined, places: places.slice(2), startKey: null },
];
const stampedOn = (...keys: string[]) => new Map(keys.map((k) => [k, "2026-01-01"]));

describe("spec 0039: share cards", () => {
  describe("AC-2: what a card freezes", () => {
    it("holds the numbers of the dashboard and the walked ranges, nothing about single stamps or dates", () => {
      const snapshot = buildShareSnapshot(places, stages, stampedOn("a", "b", "c"), new Set());
      expect(snapshot).toEqual({
        stampsDone: 3,
        stampsTotal: 4,
        percent: 50,
        kmDone: 20,
        kmLeft: 20,
        stagesDone: 1,
        stagesTotal: 2,
        ranges: [[0, 20]],
      });
      expect(JSON.stringify(snapshot)).not.toContain("2026");
    });

    it("counts a waived place as done for its stage, as the stats page does", () => {
      const snapshot = buildShareSnapshot(places, stages, stampedOn("a", "b", "d"), new Set(["c"]));
      expect(snapshot.stagesDone).toBe(2);
      expect(snapshot.stampsDone).toBe(3);
      expect(snapshot.percent).toBe(100);
    });

    it("an empty progress is 0 % and no ranges", () => {
      const snapshot = buildShareSnapshot(places, stages, new Map(), new Set());
      expect(snapshot).toMatchObject({ stampsDone: 0, percent: 0, kmDone: 0, kmLeft: 40, stagesDone: 0, ranges: [] });
    });
  });

  describe("AC-4: the link", () => {
    it("accepts exactly 32 lowercase hex characters", () => {
      expect(isShareToken("ab".repeat(16))).toBe(true);
      expect(isShareToken("AB".repeat(16))).toBe(false);
      expect(isShareToken("ab".repeat(16).slice(1))).toBe(false);
      expect(isShareToken("ab".repeat(16) + "0")).toBe(false);
      expect(isShareToken("../../etc/passwd")).toBe(false);
      expect(isShareToken("")).toBe(false);
    });

    it("is /<locale>/share/<token> on the origin", () => {
      expect(shareUrl("https://kektura-tracker.com", "hu", "ab".repeat(16))).toBe(`https://kektura-tracker.com/hu/share/${"ab".repeat(16)}`);
    });
  });

  describe("AC-9: Telegram's share dialog", () => {
    it("carries the link and the text, both encoded", () => {
      const url = telegramShareUrl("https://kektura-tracker.com/en/share/abc?x=1&y=2", "54% & more");
      expect(url).toBe(
        "https://t.me/share/url?url=https%3A%2F%2Fkektura-tracker.com%2Fen%2Fshare%2Fabc%3Fx%3D1%26y%3D2&text=54%25%20%26%20more",
      );
    });
  });

  describe("AC-4: reading a card back", () => {
    const row: ShareCardRow = {
      created_at: "2026-10-08T10:00:00Z",
      display_name: null,
      stamps_done: 87,
      stamps_total: 161,
      percent: 54,
      km_done: 636.2,
      km_left: 541,
      stages_done: 14,
      stages_total: 27,
      ranges: [[0, 12.5], [20, 30]],
    };

    it("turns a row into a card", () => {
      expect(toShareCard(row)).toEqual({
        createdAt: "2026-10-08T10:00:00Z",
        name: null,
        stampsDone: 87,
        stampsTotal: 161,
        percent: 54,
        kmDone: 636.2,
        kmLeft: 541,
        stagesDone: 14,
        stagesTotal: 27,
        ranges: [[0, 12.5], [20, 30]],
      });
    });

    it("reads numeric columns that arrive as strings", () => {
      expect(toShareCard({ ...row, km_done: "636.2" as unknown as number }).kmDone).toBe(636.2);
    });

    it("drops anything in `ranges` that is not a pair of numbers going forward", () => {
      expect(parseRanges([[1, 2], [3], ["a", "b"], [5, 4], null, "x", [6, 7, 8], [9, 10]])).toEqual([[1, 2], [9, 10]]);
      expect(parseRanges(null)).toEqual([]);
      expect(parseRanges({ 0: [1, 2] })).toEqual([]);
    });
  });

  describe("AC-5: the map", () => {
    const route: Route = {
      points: [
        [16, 47, 0],
        [17, 47, 10],
        [17, 48, 20],
      ],
    };

    it("fits the requested width, keeps the trail's proportions and marks both ends", () => {
      const map = shareMapPaths(route, [[0, 10]], 400);
      expect(map.width).toBe(400);
      // One degree of longitude is cos(47.5 degrees) = 0.675 of a degree of latitude here, so the 1 x 1 degree trail is
      // 0.675 wide and 1 tall: (400 - 24) / 0.675 + 24 = 581 px.
      expect(map.height).toBe(581);
      // Coordinates are rounded to a tenth of a pixel.
      expect(map.start).toEqual([12, 568.6]); // the south-west end: left and at the bottom
      expect(map.end[0]).toBeCloseTo(388, 0); // the north-east end: right and at the top
      expect(map.end[1]).toBe(12);
      expect(map.trail.startsWith("M12 568.6L")).toBe(true);
    });

    it("draws the walked ranges as separate sub-paths and the whole trail once", () => {
      const map = shareMapPaths(route, [[0, 5], [12, 20]], 400);
      expect(map.walked.match(/M/g)).toHaveLength(2);
      expect(map.trail.match(/M/g)).toHaveLength(1);
    });

    it("draws nothing walked when no range is given", () => {
      expect(shareMapPaths(route, [], 400).walked).toBe("");
    });

    it("thins vertices that lie closer than the eye can tell apart, but keeps the last one", () => {
      const dense: Route = { points: Array.from({ length: 2001 }, (_, i) => [16 + i * 0.00001, 47 + i * 0.00001, i * 0.01] as [number, number, number]).concat([[18, 48, 30]]) };
      const map = shareMapPaths(dense, [], 400);
      expect(map.trail.split("L").length).toBeLessThan(300);
      expect(map.trail.endsWith(`${map.end[0]} ${map.end[1]}`)).toBe(true);
    });

    it("an empty route draws nothing", () => {
      expect(shareMapPaths({ points: [] }, [], 400)).toMatchObject({ trail: "", walked: "", height: 0 });
    });
  });
});
