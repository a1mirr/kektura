# 0011: Split TrailMap into focused pieces, with an E2E safety net

Status: Done
Owner code: `src/components/TrailMap.tsx`, `src/components/trail-map/` and `src/lib/map-*.ts`

## Goal

`TrailMap.tsx` is about 800 lines of imperative MapLibre code: map setup, layers, popups, the route
planner, fullscreen and the layer toggles in one component with many refs. Split it so each piece can
be read, changed and tested on its own, without changing any behaviour.

## Behaviour

- **AC-1**: First, before refactoring, add E2E tests for the map behaviours the DOM allows (spec 0003):
  - the map canvas renders;
  - each layer toggle persists across a reload (AC-10);
  - the fullscreen button enters and leaves fullscreen, and Esc leaves it (AC-11);
  - the 📍 row button scrolls the map into view (AC-13);
  - the route planner panel shows numbers for two stamps (AC-3 to AC-8), if a stable way to trigger it
    exists. Prefer a test-only hook over pixel clicks on the canvas, and no test hook in production
    code paths.

  These tests must pass before and after the refactor.
- **AC-2**: All of spec 0003's behaviour (AC-1 to AC-16) is unchanged.
- **AC-3**: `TrailMap.tsx` becomes a composition of focused hooks/modules, for example map creation +
  sources/layers, stamp popups, restaurant popups, route planner state, fullscreen, layer toggles with
  persistence. No resulting file is over ~300 lines.
- **AC-4**: Pure pieces that move out (popup DOM builders, storage helpers, layer definitions) get unit
  tests.

## Out of scope

New map features; replacing MapLibre; changing the data files.

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2 | `e2e/map.spec.ts` (written and green against the unrefactored component first, in its own commit) + existing E2E |
| AC-3 | review (file sizes). `TrailMap.tsx` is 117 lines, a composition of `src/components/trail-map/`: `useLayerToggles` (55), `useFullscreen` (44), `useRoutePlanner` (86), `useRestaurants` (34), `useMapData` (45), `useMapInstance` (96) with `addTrailLayers` (32), `watchDetailRoute` (34), `stampPopups` (115), `restaurantPopups` (49), `listenForFocus` (28), plus `RoutePanel` (57), `LayerToggles` (74), `types` (54), `useLatest` (11). The largest file is 118 lines (`src/lib/map-layers.ts`). |
| AC-4 | `src/lib/map-storage.test.ts`, `map-data.test.ts`, `map-layers.test.ts`, `map-popups.test.ts`, `map-reveal.test.ts` |

## Notes

- The map is not React state: `TrailMap` keeps one mutable handle (`map`, `ready`, `route`) in a ref and the
  hooks update the map in place, which is what keeps position and zoom when a stamp changes (0003 AC-16).
  Hooks and map event handlers read other changing values through `useLatest` refs.
- The route-planner test (`e2e/map.spec.ts`) needs no test hook in production code: it uses the 📍 button to
  fly the map to a stamp, which centres it, then clicks the canvas centre to open the stamp's popup.
- Not covered by E2E (canvas-only): the amber highlight and map fit (0003 AC-3), the hover tooltips, the walked
  lines, and marking a stamp from its popup.
