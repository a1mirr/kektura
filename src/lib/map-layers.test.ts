import { describe, expect, it } from "vitest";
import { DETAIL_ZOOM, EXTRAS_LAYER, RESTAURANTS_LAYER, SOURCE_IDS, STAMPS_LAYER, trailLayers } from "./map-layers";

const all = { stamps: true, extras: false, restaurants: false };

describe("spec 0011: map layer definitions (spec 0003)", () => {
  it("AC-4: layers are listed bottom to top, lines under the highlight under the points", () => {
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

  it("AC-4: every layer reads from one of the declared sources, and every source is drawn", () => {
    const used = trailLayers(all).map((l) => ("source" in l ? l.source : undefined));
    for (const source of used) expect(SOURCE_IDS).toContain(source);
    for (const source of SOURCE_IDS) expect(used).toContain(source);
  });

  it("AC-4: the toggled layers start with the visibility they are given", () => {
    const visibility = (initial: Parameters<typeof trailLayers>[0], id: string) =>
      trailLayers(initial).find((l) => l.id === id)?.layout?.visibility;
    expect(visibility(all, STAMPS_LAYER)).toBe("visible");
    expect(visibility(all, EXTRAS_LAYER)).toBe("none");
    expect(visibility(all, RESTAURANTS_LAYER)).toBe("none");
    expect(visibility({ stamps: false, extras: true, restaurants: true }, STAMPS_LAYER)).toBe("none");
    expect(visibility({ stamps: false, extras: true, restaurants: true }, EXTRAS_LAYER)).toBe("visible");
    expect(visibility({ stamps: false, extras: true, restaurants: true }, RESTAURANTS_LAYER)).toBe("visible");
  });

  it("AC-4: the not-walked line is dashed and the walked line is solid (0003 AC-2)", () => {
    const layers = trailLayers(all);
    const paint = (id: string) => layers.find((l) => l.id === id)?.paint as Record<string, unknown>;
    expect(paint("todo")["line-dasharray"]).toBeDefined();
    expect(paint("done")["line-dasharray"]).toBeUndefined();
  });

  it("AC-4: the detailed route takes over at zoom 9 (0003 AC-9)", () => {
    expect(DETAIL_ZOOM).toBe(9);
  });
});
