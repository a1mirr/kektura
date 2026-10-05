# 0003: Map lines, the route planner and the comparison map

Status: Done
Owner code: `src/lib/route-geometry.ts`, `src/lib/route-stats.ts`, `src/components/TrailMap.tsx`, `src/components/trail-map/`, `src/lib/map-*.ts`,
`src/lib/compare-map.ts`, `src/components/CompareMap.tsx`

## Goal

Draw walked and not-yet-walked parts of the trail, and let the user pick two stamps to see the
stretch between them with its distance, ascent, descent and walking time. On a friend's page the same map
shows who of the two walked which stretch.

## Behaviour

### Geometry

The route files (`public/data/okt-route.json`, `okt-route-detail.json` at zoom >= 9) are
`[lng, lat, km]` points sorted by km.

- **AC-1**: Cutting the route from km A to km B interpolates both ends between the neighbouring
  vertices and keeps every vertex in between; distances past the end are clamped to the last point.
- **AC-2**: The walked ranges (0001 AC-3) are drawn as blue lines; everything else, i.e. the gaps
  between the (sorted, possibly overlapping) ranges and the ends, is drawn grey dashed. With
  "Walked stretches" switched off the whole trail is grey.
- **AC-3**: With both route ends chosen, the stretch between them is highlighted (amber) and the map
  fits it; without a pair there is no highlight.

### Route planner numbers

From `public/data/okt-hops.json`: 160 hops between neighbouring places, from the MTSZ table.

- **AC-4**: Places are ordered along the hop chain. Walking west -> east sums the hops' km, ascent,
  descent and forward times.
- **AC-5**: Walking east -> west swaps ascent and descent and uses the "back" times.
- **AC-6**: The Visegrád -> Nagymaros ferry hop adds distance but no time; the result is flagged so
  the panel says "+ ferry" (or "ferry (no time in the table)" when it is the only hop).
- **AC-7**: Choosing the same place twice, or a place not on the chain, gives no numbers.
- **AC-8**: Times are shown as `h:mm` (e.g. 347:45 for the whole trail).

### Map UI

- **AC-9**: The map draws the route from `okt-route.json` (~30 m simplification) and swaps to
  `okt-route-detail.json` (~3 m) at zoom >= 9, loading it on first need; if loading fails it stays on
  the overview and retries on the next zoom change. Tiles: OpenStreetMap, with attribution.
- **AC-10**: Layer toggles under the map: walked stretches and official stamps (on by default), extra
  stamps (with their count) and restaurants (off by default; shown once their data has loaded). Each
  choice persists in localStorage.
- **AC-11**: The fullscreen button uses the native Fullscreen API with a CSS overlay fallback; Esc or
  the button leaves it and the page scrolls normally again.
- **AC-12**: Hovering a stamp shows its name. Clicking one opens a popup: route from here, route to
  here, mark/unmark walked (official places and extra stamps; same results as 0002 AC-10, AC-11), and
  show in list. "Show in list" leaves fullscreen, opens the stamp's stage if collapsed, scrolls to its
  row (`place-<key>` / `extra-<id>`) and flashes it.
- **AC-13**: The 📍 button in a list row flies the map to that stamp (zoom >= 12) and labels it; for an
  extra stamp it also switches the extra-stamps layer on.
- **AC-14**: Restaurants (`public/data/restaurants.json`: within 5 km of the trail, built by
  `scripts/build-restaurants.mjs` from an etteremhet.hu results page): hover shows name and distance,
  click pins a popup with a link to the restaurant's page.
- **AC-15**: Popup contents are built from DOM text nodes, never `innerHTML`, so names in the data can't
  inject markup; restaurant links are only emitted for `https:` URLs.
- **AC-16**: Updating stamps keeps the map's position and zoom (new data is pushed into the existing
  map, not a new one).
- **AC-21**: The restaurants layer (AC-10, AC-14) is the feature flag `restaurants` (spec 0035). While it is off for the
  viewer the dashboard's map has no restaurants checkbox, never requests `restaurants.json` and its layer stays empty
  (the file itself is public data and stays reachable by its address); the About page does not credit etteremhet.hu for
  restaurants it does not show (spec 0015 AC-4). It is on in production.

### Comparison map

The map of a friend's page (spec 0024 AC-22): the trail as two people have walked it. It shares the base map, the
geometry (AC-9) and the layer code with the dashboard's map, and is read-only. It needs JavaScript: until it has loaded
(or without JavaScript) a grey placeholder stands in its place, and the cards and the stage list above and below it do not need it.

- **AC-18**: The trail is drawn by who walked each stretch, in a line style as well as a colour so that colour alone is
  not needed: both solid (green), only me dashed (blue), only them dotted (orange), nobody a thin faint grey line. The
  places are marked the same way (filled in the colour of their state, hollow for nobody), and a legend under the map names
  the four.
- **AC-19**: A switch picks the view: "both" (the default, AC-18), "mine" or "theirs". In "mine" and "theirs" the map is
  the one the owner sees on their dashboard (AC-2): their walked stretches blue and solid, the rest grey dashed, their
  stamped places filled. The legend follows the view.
- **AC-20**: Hovering a place names it with its number in the list, its name and its state ("4.2 Lokó-pihenő · Only
  them"; on a touch screen the legend and the cards carry the meaning, since there is no hover). Clicking or tapping a place
  brings its row in the stage list of the page into view and flashes it, opening its stage first if it is collapsed, as "Show
  in list" does on the dashboard's map (AC-12). The map opens no menu and nothing can be stamped, routed or planned from
  it. The detailed route takes over at zoom 9 as on the dashboard (AC-9).

### Structure

- **AC-17**: `TrailMap.tsx` is a composition of focused hooks and modules (`src/components/trail-map/`: map
  creation with its sources and layers, stamp and restaurant popups, route planner state, fullscreen, layer
  toggles with persistence, data and focus listeners) and of pure helpers in `src/lib/map-*.ts` (popup DOM builders,
  storage helpers, layer definitions, GeoJSON builders, row reveal), and no file of them is over about 300 lines.
  The pure helpers have unit tests.

## Out of scope

Routing off the trail; replacing MapLibre.

## Notes

- The map is not React state: `TrailMap` keeps one mutable handle (`map`, `ready`, `route`) in a ref and the hooks
  update the map in place, which is what keeps position and zoom when a stamp changes (AC-16). Hooks and map
  event handlers read other changing values through `useLatest` refs.
- The route-planner E2E test needs no test hook in production code: it uses the 📍 button to fly the map to a
  stamp, which centres it, then clicks the canvas centre to open the stamp's popup.
- What E2E cannot see (canvas pixels and hover) is checked with the checklist below: layer visibility and the line
  colours, the amber highlight and map fit, hover names, restaurant popups, the look of the detailed route.

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2, AC-3 (line) | `src/lib/route-geometry.test.ts` |
| AC-2 (line colours, toggle), AC-3 (amber highlight, fit) | manual (the map is WebGL pixels that E2E cannot read): see the checklist below. Last checked: never recorded. |
| AC-4 ... AC-8 | `src/lib/route-stats.test.ts` |
| Table totals | `tests/trail-data.test.ts` (0004 AC-6) |
| AC-14, AC-21 | `src/components/trail-map/useRestaurants.test.tsx` (fetched once while the flag is on, nothing while it is off), `e2e/feature-flags.spec.ts` (the checkbox, the request and the About credit in each state) |
| AC-9, AC-10, AC-11, AC-13, AC-16 | `e2e/map.spec.ts` (the detailed route is requested once on first need and again after a failed load on the next zoom change; toggles and their persistence; fullscreen; 📍 on a place and on an extra stamp, which switches that layer on; stamping from the list keeps the stamp's label where it was on the map) |
| AC-18, AC-19, AC-20 | `src/lib/compare-map.test.ts` (the lines and points of each view), `src/lib/map-layers.test.ts` (the layers: a style per state), `e2e/friends-compare.spec.ts` (the switch and the legend; a click on a place, aimed from the map's fit to the trail, opens its stage, flashes a row of the list and opens no popup); the hover text and the point's key and number: `src/lib/compare-map.test.ts`, `src/lib/friends-compare.test.ts`; the row reveal itself: `src/lib/map-reveal.test.ts` (AC-12) |
| AC-18, AC-19, AC-20 (colours and line styles on the canvas, hover, the detailed route) | manual (the map is WebGL pixels that E2E cannot read): see the checklist below. Last checked: never recorded. |
| AC-17 | `src/lib/map-storage.test.ts`, `map-data.test.ts`, `map-layers.test.ts`, `map-popups.test.ts`, `map-reveal.test.ts` (the pure helpers); `tests/map-structure.test.ts` (no file of the map code is over 300 lines) |
| AC-4, AC-8, AC-12 (route from / to, mark and unmark) | `e2e/map.spec.ts`: two stamps picked through their popups show the stretch's numbers; a failed save keeps the popup open, the next save marks the stamp, and the popup of a marked stamp unmarks it |
| AC-14 (restaurants), AC-12 (hover names, "Show in list" in a collapsed stage), AC-13 (the flight to zoom 12 or more), AC-9 (the line looks more detailed) | manual (canvas hover, click and pixels): see the checklist below; AC-15 popup builders: `src/lib/map-popups.test.ts`; the reveal of a list row: `src/lib/map-reveal.test.ts`. Last checked: never recorded. |

Manual checklist (dashboard, `npm run dev:test`, canvas interactions):

- AC-2 visibility: untick "Stamps" and "Walked stretches" (the whole trail turns grey dashed), tick "Show extra stamps" and "Show restaurants"; dots and lines appear and disappear at once, without a reload.
- AC-3: pick a start and an end through the popups: the stretch between them is highlighted amber and the map fits it; clearing removes it.
- AC-12: "Show in list" in a collapsed stage opens the stage, scrolls to the row and flashes it; in fullscreen it leaves fullscreen first.
- AC-9: zoom in past level 9: the line looks visibly more detailed; zoom out and it looks as before (the requests for the detailed file are E2E-tested).
- AC-12: hovering a stamp shows its name.
- AC-13: press 📍 on a row: the map flies there at zoom 12 or more.
- AC-14: with restaurants on, hover one (name and distance) and click it (pinned popup with an "Open on etteremhet.hu" link that opens in a new tab).
- AC-18, AC-19: on a friend's page with both of you stamped, the map shows green solid, blue dashed, orange dotted and faint grey stretches; "Mine" and "Theirs" show blue solid and grey dashed, and the dots follow.
- AC-20: hovering a place on that map shows its number, name and state (the click to the list is E2E-tested); zoom in past level 9 and the line gets more detailed.
