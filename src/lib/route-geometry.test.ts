import { describe, expect, it } from "vitest";
import { kmIndex, segmentLines, sliceRoute, splitRoute, type Route } from "./route-geometry";

// A straight 3 km line along the equator: 1 degree of longitude per km.
const route: Route = {
  points: [
    [0, 0, 0],
    [1, 0, 1],
    [2, 0, 2],
    [3, 0, 3],
  ],
};

const coords = (fc: ReturnType<typeof segmentLines>) => fc.features.map((f) => f.geometry.coordinates);

describe("spec 0003: route geometry", () => {
  it("AC-1: kmIndex finds the first vertex at (or strictly after) a distance", () => {
    expect(kmIndex(route.points, 1)).toBe(1);
    expect(kmIndex(route.points, 1, true)).toBe(2);
    expect(kmIndex(route.points, 1.5)).toBe(2);
    expect(kmIndex(route.points, 99)).toBe(4);
  });

  it("AC-1: sliceRoute interpolates both ends and keeps the vertices in between", () => {
    expect(sliceRoute(route, 1.5, 2.5)).toEqual([
      [1.5, 0],
      [2, 0],
      [2.5, 0],
    ]);
    expect(sliceRoute(route, 1, 2)).toEqual([
      [1, 0],
      [2, 0],
    ]);
    expect(sliceRoute(route, 0, 3)).toEqual(route.points.map(([lng, lat]) => [lng, lat]));
  });

  it("AC-1: sliceRoute clamps distances beyond the end of the trail", () => {
    expect(sliceRoute(route, 2, 99).at(-1)).toEqual([3, 0]);
  });

  it("AC-2: splitRoute draws walked ranges and the gaps between them", () => {
    const { done, todo } = splitRoute(route, [[1, 2]]);
    expect(coords(done)).toEqual([
      [
        [1, 0],
        [2, 0],
      ],
    ]);
    expect(coords(todo)).toEqual([
      [
        [0, 0],
        [1, 0],
      ],
      [
        [2, 0],
        [3, 0],
      ],
    ]);
  });

  it("AC-2: nothing walked -> the whole trail is todo; everything walked -> no todo", () => {
    expect(splitRoute(route, []).done.features).toEqual([]);
    expect(splitRoute(route, []).todo.features).toHaveLength(1);
    expect(splitRoute(route, [[0, 3]]).todo.features).toEqual([]);
  });

  it("AC-2: unsorted and overlapping ranges leave no gaps between them", () => {
    const { todo } = splitRoute(route, [
      [2, 3],
      [0, 1.5],
      [1, 2.5],
    ]);
    expect(todo.features).toEqual([]);
  });

  it("AC-3: the planner highlight is one line for a pair and empty without one", () => {
    expect(coords(segmentLines(route, [0.5, 1.5]))).toEqual([
      [
        [0.5, 0],
        [1, 0],
        [1.5, 0],
      ],
    ]);
    expect(segmentLines(route, null).features).toEqual([]);
  });
});
