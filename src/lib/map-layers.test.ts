import { describe, expect, it } from "vitest";
import {
  COMPARE_MOVED_RING_LAYER,
  COMPARE_DOTS_LAYER,
  COMPARE_SOURCE_IDS,
  compareLayers,
  DETAIL_ZOOM,
  EXTRAS_LAYER,
  MOVED_RING_LAYER,
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
      "moved-ring",
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
      "compare-moved-ring",
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

describe("spec 0003: the ring of a stamp that moved", () => {
  const ring = (initial: Parameters<typeof trailLayers>[0]) => trailLayers(initial).find((l) => l.id === MOVED_RING_LAYER)!;

  it("AC-26: the ring is an empty circle with a stroke, drawn from the stamps' source for the points that moved only, under the dots", () => {
    const layers = trailLayers(all);
    const layer = ring(all);
    expect(layer).toMatchObject({ type: "circle", source: "dots", filter: ["==", ["get", "moved"], true] });
    const paint = layer.paint as Record<string, unknown>;
    expect(paint["circle-opacity"]).toBe(0);
    expect(paint["circle-stroke-width"]).toBeGreaterThanOrEqual(2);
    expect(layers.findIndex((l) => l.id === MOVED_RING_LAYER)).toBe(layers.findIndex((l) => l.id === STAMPS_LAYER) - 1);
  });

  it("AC-26: the ring is wider than the dot it surrounds at every zoom, so it is told apart by its shape", () => {
    const radius = (id: string) => (trailLayers(all).find((l) => l.id === id)!.paint as Record<string, unknown>)["circle-radius"] as unknown[];
    const ringStops = radius(MOVED_RING_LAYER).slice(3);
    const dotStops = radius(STAMPS_LAYER).slice(3);
    expect(ringStops.filter((_, i) => i % 2 === 1).map((r, i) => Number(r) - Number(dotStops.filter((_, j) => j % 2 === 1)[i]))).toEqual([4, 5]);
  });

  it("AC-26: the ring follows the stamps' toggle", () => {
    expect(ring(all).layout?.visibility).toBe("visible");
    expect(ring({ stamps: false, extras: true, restaurants: true }).layout?.visibility).toBe("none");
  });

  it("AC-26: a friend's map has the same ring around the places that moved", () => {
    const layers = compareLayers();
    const layer = layers.find((l) => l.id === COMPARE_MOVED_RING_LAYER)!;
    expect(layer).toMatchObject({ type: "circle", source: "compare-dots", filter: ["==", ["get", "moved"], true] });
    expect(layers.findIndex((l) => l.id === COMPARE_MOVED_RING_LAYER)).toBe(layers.findIndex((l) => l.id === COMPARE_DOTS_LAYER) - 1);
  });
});
