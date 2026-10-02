// What the dashboard hands the map, and the GeoJSON built from it (spec 0003).
import type { Feature, FeatureCollection, Point } from "geojson";

export type MapPoint = {
  placeKey: string;
  name: string;
  lat: number;
  lng: number;
  km: number;
  stamped: boolean;
};

export type MapExtra = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  stamped: boolean;
};

export type Restaurant = {
  name: string;
  city: string;
  url: string;
  lat: number;
  lng: number;
  distKm: number; // straight line to the nearest point of the trail
};

const pointFeatures = (
  items: {
    lat: number;
    lng: number;
    name: string;
    stamped: boolean;
    kind: string;
    key: string;
  }[],
): FeatureCollection<Point> => ({
  type: "FeatureCollection",
  features: items.map((p): Feature<Point> => ({
    type: "Feature",
    properties: { name: p.name, stamped: p.stamped, kind: p.kind, key: p.key },
    geometry: { type: "Point", coordinates: [p.lng, p.lat] },
  })),
});

export const placesData = (points: MapPoint[]) =>
  pointFeatures(points.map((p) => ({ ...p, kind: "place", key: p.placeKey })));

export const extrasData = (extras: MapExtra[]) =>
  pointFeatures(extras.map((e) => ({ ...e, kind: "extra", key: String(e.id) })));

export const restaurantsData = (items: Restaurant[]): FeatureCollection<Point> => ({
  type: "FeatureCollection",
  features: items.map((r): Feature<Point> => ({
    type: "Feature",
    properties: { name: r.name, city: r.city, url: r.url, distKm: r.distKm },
    geometry: { type: "Point", coordinates: [r.lng, r.lat] },
  })),
});
