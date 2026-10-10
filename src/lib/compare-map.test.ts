import { describe, expect, it } from "vitest";
import type { ComparisonRanges } from "./compare";
import { compareDots, compareHoverText, compareLines, WHO_COLOR, WHO_LINE_STYLE, type ComparePoint } from "./compare-map";
import { DONE } from "./map-layers";
import type { Route } from "./route-geometry";

const route: Route = { points: [0, 10, 20, 30, 40].map((km) => [16 + km / 100, 47, km] as [number, number, number]) };
const ranges: ComparisonRanges = {
  both: [[10, 20]],
  me: [[0, 10]],
  them: [[20, 30]],
  neither: [[30, 40]],
  mine: [[0, 20]],
  theirs: [[10, 30]],
};

const parts = (view: "both" | "mine" | "theirs") =>
  compareLines(route, ranges, view).features.map((f) => ({ ...f.properties, from: f.geometry.coordinates[0][0], to: f.geometry.coordinates.at(-1)![0] }));

describe("spec 0003: the comparison map's lines and points", () => {
  it("AC-18: the four states are drawn solid, dashed, dotted and faint, each in its own colour", () => {
    expect(new Set(Object.values(WHO_LINE_STYLE)).size).toBe(4);
    expect(new Set(Object.values(WHO_COLOR)).size).toBe(4);
    expect(WHO_LINE_STYLE).toEqual({ both: "solid", me: "dashed", them: "dotted", neither: "faint" });
  });

  it("AC-18: in the combined view every stretch of the trail is in exactly one state", () => {
    expect(parts("both")).toEqual([
      { style: "solid", color: WHO_COLOR.both, from: 16.1, to: 16.2 },
      { style: "dashed", color: WHO_COLOR.me, from: 16, to: 16.1 },
      { style: "dotted", color: WHO_COLOR.them, from: 16.2, to: 16.3 },
      { style: "faint", color: WHO_COLOR.neither, from: 16.3, to: 16.4 },
    ]);
  });

  it("AC-18: a stretch nobody walked is faint even when the figures leave it out, e.g. past the last place", () => {
    const shorter: ComparisonRanges = { ...ranges, neither: [] };
    const lines = compareLines(route, shorter, "both").features.filter((f) => f.properties?.style === "faint");
    expect(lines).toHaveLength(1);
  });

  it("AC-19: 'mine' and 'theirs' draw one person's walked stretches blue and solid, the rest dashed grey, as their dashboard does", () => {
    expect(parts("mine")).toEqual([
      { style: "solid", color: DONE, from: 16, to: 16.2 },
      expect.objectContaining({ style: "todo", from: 16.2, to: 16.4 }),
    ]);
    expect(parts("theirs")).toEqual([
      { style: "solid", color: DONE, from: 16.1, to: 16.3 },
      expect.objectContaining({ style: "todo", from: 16, to: 16.1 }),
      expect.objectContaining({ style: "todo", from: 16.3, to: 16.4 }),
    ]);
  });

  const points: ComparePoint[] = (["both", "me", "them", "neither"] as const).map((who, i) => ({
    placeKey: who,
    label: `1.${who.length}`,
    name: who,
    lat: 47,
    lng: 16 + i / 10,
    who,
  }));
  const dot = (view: "both" | "mine" | "theirs", who: string) =>
    compareDots(points, view).features.find((f) => f.properties?.who === who)!.properties!;

  it("AC-18: in the combined view each place has the colour of its state and only 'neither' is hollow", () => {
    for (const who of ["both", "me", "them"] as const) {
      expect(dot("both", who)).toMatchObject({ fill: WHO_COLOR[who], stroke: WHO_COLOR[who] });
    }
    expect(dot("both", "neither")).toMatchObject({ fill: "#ffffff" });
  });

  it("AC-19: in one person's view a place is filled when that person stamped it, whatever the other did", () => {
    const filled = (view: "mine" | "theirs") => points.filter((p) => dot(view, p.who).fill !== "#ffffff").map((p) => p.who);
    expect(filled("mine")).toEqual(["both", "me"]);
    expect(filled("theirs")).toEqual(["both", "them"]);
  });

  it("AC-20: a point carries the key of its list row and its number, for the click and the hover", () => {
    const f = compareDots(points, "both").features.find((p) => p.properties?.who === "me")!;
    expect(f.properties).toMatchObject({ key: "me", label: "1.2", name: "me" });
  });

  it("AC-20: the hover shows the number, the name and the state", () => {
    expect(compareHoverText({ label: "4.2", name: "Lokó-pihenő" }, "Only them")).toBe("4.2 Lokó-pihenő · Only them");
  });
});

describe("spec 0003: a friend's map and the stamps that moved", () => {
  it("AC-26: a place that moved has `moved` on its point (the ring), every other has it off", () => {
    const pts: ComparePoint[] = [
      { placeKey: "A", label: "1.1", name: "A", lat: 47, lng: 16, who: "both", moved: true },
      { placeKey: "B", label: "1.2", name: "B", lat: 47, lng: 16.1, who: "neither" },
    ];
    for (const view of ["both", "mine", "theirs"] as const) {
      expect(compareDots(pts, view).features.map((f) => f.properties?.moved)).toEqual([true, false]);
    }
  });
});
