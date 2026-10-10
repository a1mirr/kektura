import type { Feature, FeatureCollection, Point } from "geojson";
import { placeKeyOf, type Checkpoint } from "./progress";

export type MapPoint = {
  placeKey: string;
  name: string;
  lat: number;
  lng: number;
  km: number;
  stamped: boolean;
  note?: string;
  movedNote?: string;
  code: string | null;
};

// A retired stamp is never one, even when its row has coordinates: a stamp that no longer exists is not somewhere to
// go, to route to or to stamp from the map.
export function buildMapPoints(
  checkpoints: Checkpoint[],
  placeKm: ReadonlyMap<string, number>,
  stamped: { has: (key: string) => boolean },
  noteOf: (key: string) => string | undefined,
  movedNoteOf: (checkpoint: Checkpoint) => string | undefined = () => undefined,
): MapPoint[] {
  return checkpoints
    .filter((c) => c.retired_on == null && c.lat != null && c.lng != null)
    .map((c) => {
      const key = placeKeyOf(c);
      return { placeKey: key, name: c.name, lat: Number(c.lat), lng: Number(c.lng), km: placeKm.get(key)!, stamped: stamped.has(key), note: noteOf(key), movedNote: movedNoteOf(c), code: c.code };
    });
}

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
    moved?: boolean;
  }[],
): FeatureCollection<Point> => ({
  type: "FeatureCollection",
  features: items.map((p): Feature<Point> => ({
    type: "Feature",
    properties: { name: p.name, stamped: p.stamped, kind: p.kind, key: p.key, moved: p.moved === true },
    geometry: { type: "Point", coordinates: [p.lng, p.lat] },
  })),
});

export const placesData = (points: MapPoint[]) =>
  pointFeatures(points.map((p) => ({ ...p, kind: "place", key: p.placeKey, moved: p.movedNote !== undefined })));

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
