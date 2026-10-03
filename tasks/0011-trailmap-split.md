# 0011: Split TrailMap into focused pieces, with an E2E safety net

Status: Done
Specs: [0003](../specs/0003-map-route-planner.md) AC-17 (new, the structure); AC-1 to AC-16 unchanged (this task was written as spec 0011)

## Goal

`TrailMap.tsx` was about 800 lines of imperative MapLibre code: map setup, layers, popups, the route planner,
fullscreen and the layer toggles in one component with many refs. Split it so each piece can be read, changed and
tested on its own, without changing any behaviour.

## Done when

- [x] E2E tests for the map behaviours the DOM allows were written first, green against the unrefactored component, in their own commit: the canvas renders, each layer toggle persists across a reload, fullscreen enters and leaves (button, Esc), the 📍 row button scrolls the map into view, the route planner shows numbers for two stamps (`e2e/map.spec.ts`; no test hook in production code)
- [x] All behaviour of spec 0003 is unchanged (was 0011 AC-2)
- [x] `TrailMap.tsx` is a composition of focused hooks and modules, none over about 300 lines (was AC-3, now 0003 AC-17)
- [x] The pure pieces that moved out have unit tests (was AC-4, now 0003 AC-17)

## Spec changes

Spec 0003 gained AC-17 (the structure and the unit-tested helpers) and notes on how the map is kept outside React
state. AC-1 and AC-2 of this task described the refactor itself and are not behaviour.

## Notes

- At the end `TrailMap.tsx` was 117 lines, a composition of `src/components/trail-map/`: `useLayerToggles` (55),
  `useFullscreen` (44), `useRoutePlanner` (86), `useRestaurants` (34), `useMapData` (45), `useMapInstance` (96)
  with `addTrailLayers` (32), `watchDetailRoute` (34), `stampPopups` (115), `restaurantPopups` (49),
  `listenForFocus` (28), plus `RoutePanel` (57), `LayerToggles` (74), `types` (54), `useLatest` (11). The largest
  file was 118 lines (`src/lib/map-layers.ts`).
- Out of scope then: new map features, replacing MapLibre, changing the data files.
