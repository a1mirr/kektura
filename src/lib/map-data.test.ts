import { describe, expect, it } from "vitest";
import { extrasData, placesData, restaurantsData } from "./map-data";

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
