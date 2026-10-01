import { describe, expect, it } from "vitest";
import { fmtTime, hopOrder, routeStats, type Hop } from "./route-stats";

const hops: Hop[] = [
  { a: "A", b: "B", km: 1.1, up: 10, down: 20, tf: 30, tb: 40 },
  { a: "B", b: "C", km: 0.3, up: 0, down: 0, tf: null, tb: null, ferry: true },
  { a: "C", b: "D", km: 2.2, up: 100, down: 50, tf: 60, tb: 50 },
];
const order = hopOrder(hops);

describe("spec 0003: route stats", () => {
  it("AC-4: places are ordered along the hop chain", () => {
    expect([...order]).toEqual([
      ["A", 0],
      ["B", 1],
      ["C", 2],
      ["D", 3],
    ]);
    expect(hopOrder([]).size).toBe(0);
  });

  it("AC-4: walking west->east sums the table values with forward times", () => {
    expect(routeStats(hops, order, "A", "B")).toEqual({ km: 1.1, up: 10, down: 20, minutes: 30, ferry: false });
  });

  it("AC-5: walking east->west swaps ascent/descent and uses the back times", () => {
    expect(routeStats(hops, order, "B", "A")).toEqual({ km: 1.1, up: 20, down: 10, minutes: 40, ferry: false });
    expect(routeStats(hops, order, "D", "C")).toEqual({ km: 2.2, up: 50, down: 100, minutes: 50, ferry: false });
  });

  it("AC-6: a ferry hop adds distance but no time, and is flagged", () => {
    expect(routeStats(hops, order, "A", "D")).toEqual({ km: 3.6, up: 110, down: 70, minutes: 90, ferry: true });
    expect(routeStats(hops, order, "B", "C")).toEqual({ km: 0.3, up: 0, down: 0, minutes: 0, ferry: true });
  });

  it("AC-7: no stats for the same place twice or an unknown place", () => {
    expect(routeStats(hops, order, "A", "A")).toBeNull();
    expect(routeStats(hops, order, "A", "Z")).toBeNull();
  });

  it("AC-8: times are shown as h:mm", () => {
    expect(fmtTime(0)).toBe("0:00");
    expect(fmtTime(65)).toBe("1:05");
    expect(fmtTime(20865)).toBe("347:45");
  });
});
