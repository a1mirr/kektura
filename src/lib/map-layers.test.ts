import { describe, expect, it } from "vitest";
import {
  COMPARE_SOURCE_IDS,
  compareLayers,
  DETAIL_ZOOM,
  EXTRAS_LAYER,
  RESTAURANTS_LAYER,
  SOURCE_IDS,
  STAMPS_LAYER,
  trailLayers,
} from "./map-layers";

const all = { stamps: true, extras: false, restaurants: false };

describe("spec 0003: map layer definitions", () => {
  it("AC-17: layers are listed bottom to top, lines under the highlight under the points", () => {
    expect(trailLayers(all).map((l) => l.id)).toEqual([
      "todo-casing",
      "done-casing",
      "todo",
      "done",
      "segment-casing",
      "segment",
      "restaurants",
      "extras",
      "dots",
    ]);
  });

  it("AC-17: every layer reads from one of the declared sources, and every source is drawn", () => {
    const used = trailLayers(all).map((l) => ("source" in l ? l.source : undefined));
    for (const source of used) expect(SOURCE_IDS).toContain(source);
    for (const source of SOURCE_IDS) expect(used).toContain(source);
  });

  it("AC-17: the toggled layers start with the visibility they are given", () => {
    const visibility = (initial: Parameters<typeof trailLayers>[0], id: string) =>
      trailLayers(initial).find((l) => l.id === id)?.layout?.visibility;
    expect(visibility(all, STAMPS_LAYER)).toBe("visible");
    expect(visibility(all, EXTRAS_LAYER)).toBe("none");
    expect(visibility(all, RESTAURANTS_LAYER)).toBe("none");
    expect(visibility({ stamps: false, extras: true, restaurants: true }, STAMPS_LAYER)).toBe("none");
    expect(visibility({ stamps: false, extras: true, restaurants: true }, EXTRAS_LAYER)).toBe("visible");
    expect(visibility({ stamps: false, extras: true, restaurants: true }, RESTAURANTS_LAYER)).toBe("visible");
  });

  it("AC-2, AC-17: the not-walked line is dashed and the walked line is solid", () => {
    const layers = trailLayers(all);
    const paint = (id: string) => layers.find((l) => l.id === id)?.paint as Record<string, unknown>;
    expect(paint("todo")["line-dasharray"]).toBeDefined();
    expect(paint("done")["line-dasharray"]).toBeUndefined();
  });

  it("AC-9, AC-17: the detailed route takes over at zoom 9", () => {
    expect(DETAIL_ZOOM).toBe(9);
  });
});

describe("spec 0003: comparison map layers", () => {
  const layers = compareLayers();
  const paint = (id: string) => layers.find((l) => l.id === id)?.paint as Record<string, unknown>;

  it("AC-18: layers are listed bottom to top: casing, faint, dashed todo, dotted, dashed, solid, points", () => {
    expect(layers.map((l) => l.id)).toEqual([
      "compare-casing",
      "compare-faint",
      "compare-todo",
      "compare-dotted",
      "compare-dashed",
      "compare-solid",
      "compare-dots",
    ]);
  });

  it("AC-18: every layer reads from a declared source and every source is drawn", () => {
    const used = layers.map((l) => ("source" in l ? l.source : undefined));
    for (const source of used) expect(COMPARE_SOURCE_IDS).toContain(source);
    for (const source of COMPARE_SOURCE_IDS) expect(used).toContain(source);
  });

  it("AC-18: the four states differ in more than colour: solid, dashed, dotted and a thin faint line", () => {
    expect(paint("compare-solid")["line-dasharray"]).toBeUndefined();
    expect(paint("compare-dashed")["line-dasharray"]).toBeDefined();
    expect(paint("compare-dotted")["line-dasharray"]).toBeDefined();
    expect(paint("compare-dashed")["line-dasharray"]).not.toEqual(paint("compare-dotted")["line-dasharray"]);
    expect(paint("compare-faint")["line-width"]).toBeLessThan(paint("compare-solid")["line-width"] as number);
  });

  it("AC-18: each line layer takes only the features of its style, and the colour comes from the feature", () => {
    for (const [id, style] of [["compare-faint", "faint"], ["compare-todo", "todo"], ["compare-dotted", "dotted"], ["compare-dashed", "dashed"], ["compare-solid", "solid"]]) {
      const layer = layers.find((l) => l.id === id) as { filter: unknown; paint: Record<string, unknown> };
      expect(layer.filter).toEqual(["==", ["get", "style"], style]);
      expect(layer.paint["line-color"]).toEqual(["get", "color"]);
    }
  });
});
