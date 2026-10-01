# 0011: Split TrailMap into focused pieces, with an E2E safety net

Status: Accepted
Owner code: `src/components/TrailMap.tsx` and new modules next to it / in `src/lib`

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
| AC-1, AC-2 | `e2e/map.spec.ts` + existing E2E |
| AC-3 | review (file sizes) |
| AC-4 | unit tests next to the extracted modules |
