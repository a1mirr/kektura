import { describe, expect, it } from "vitest";
import { buildMapPoints, extrasData, placesData, restaurantsData } from "./map-data";
import type { Checkpoint } from "./progress";

describe("spec 0003: GeoJSON built for the map", () => {
  it("AC-17: places become points as [lng, lat] with kind 'place' and their place key", () => {
    const fc = placesData([
      {
        placeKey: "OKTPH_02",
        name: "Hét-forrás",
        lat: 47.4,
        lng: 16.5,
        km: 8.1,
        stamped: true,
      },
    ]);
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toEqual([
      {
        type: "Feature",
        properties: {
          name: "Hét-forrás",
          stamped: true,
          kind: "place",
          key: "OKTPH_02",
        },
        geometry: { type: "Point", coordinates: [16.5, 47.4] },
      },
    ]);
  });

  it("AC-17: extra stamps become points of kind 'extra' keyed by their numeric id as a string", () => {
    const [f] = extrasData([{ id: 7, name: "Castle", lat: 1, lng: 2, stamped: false }]).features;
    expect(f.properties).toEqual({
      name: "Castle",
      stamped: false,
      kind: "extra",
      key: "7",
    });
    expect(f.geometry.coordinates).toEqual([2, 1]);
  });

  it("AC-17: restaurants carry name, city, url and distance, and nothing else", () => {
    const [f] = restaurantsData([
      {
        name: "Étterem",
        city: "Sopron",
        url: "https://x.hu/",
        lat: 3,
        lng: 4,
        distKm: 1.5,
      },
    ]).features;
    expect(f.properties).toEqual({
      name: "Étterem",
      city: "Sopron",
      url: "https://x.hu/",
      distKm: 1.5,
    });
    expect(f.geometry.coordinates).toEqual([4, 3]);
  });

  it("AC-17: no items give an empty collection", () => {
    expect(placesData([]).features).toEqual([]);
    expect(extrasData([]).features).toEqual([]);
    expect(restaurantsData([]).features).toEqual([]);
  });
});

const row = (over: Partial<Checkpoint>): Checkpoint => ({
  id: 1, seq: 1, stage: 1, stage_seq: 1, code: "A", place_key: "A", name: "A", description: null, lat: 47, lng: 16, km_from_start: 0,
  required_from: null, retired_on: null, replaced_by: null, after_place_key: null, position_approximate: false, ...over,
});

describe("spec 0003: the map's points", () => {
  it("AC-23: a retired stamp is never a point, even with coordinates; a current stamp without coordinates is none either", () => {
    const rows = [
      row({ id: 1, code: "A", place_key: "A" }),
      row({ id: 2, code: "OLD", place_key: "OLD", name: "Old", lat: 47.5, lng: 19.9, stage_seq: null, retired_on: "2014-11-21", after_place_key: "A" }),
      row({ id: 3, code: "B", place_key: "B", lat: null, lng: null }),
    ];
    const points = buildMapPoints(rows, new Map([["A", 5]]), new Set(["A"]), () => undefined);
    expect(points.map((p) => p.placeKey)).toEqual(["A"]);
    expect(points[0]).toMatchObject({ km: 5, stamped: true });
  });

  it("AC-22: the note of each place comes from its key", () => {
    const [p] = buildMapPoints([row({})], new Map([["A", 1]]), new Set<string>(), (key) => `note ${key}`);
    expect(p.note).toBe("note A");
  });
});
