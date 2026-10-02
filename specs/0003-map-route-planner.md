# 0003: Map lines and the route planner

Status: Done
Owner code: `src/lib/route-geometry.ts`, `src/lib/route-stats.ts`, `src/components/TrailMap.tsx` (split into `src/components/trail-map/` and `src/lib/map-*.ts` by spec 0011)

## Goal

Draw walked and not-yet-walked parts of the trail, and let the user pick two stamps to see the
stretch between them with its distance, ascent, descent and walking time.

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

## Out of scope

Routing off the trail.

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2, AC-3 (line) | `src/lib/route-geometry.test.ts` |
| AC-2 (toggle), AC-3 (fit) | manual: dashboard map |
| AC-4 ... AC-8 | `src/lib/route-stats.test.ts` |
| Table totals | `tests/trail-data.test.ts` (0004 AC-6) |
| AC-10, AC-11, AC-13 | `e2e/map.spec.ts` (spec 0011) |
| AC-4, AC-8, AC-12 (route from / to) | `e2e/map.spec.ts`: two stamps picked through their popups show the stretch's numbers |
| AC-2 (layer visibility), AC-9, AC-12, AC-13 (extras), AC-14, AC-16 | manual, see the checklist below; AC-15 popup builders: `src/lib/map-popups.test.ts` |

Manual checklist (dashboard, `npm run dev:test`, canvas interactions):

- AC-10 visibility: untick "Stamps" and "Walked stretches" (the whole trail turns grey dashed), tick "Show extra stamps" and "Show restaurants"; dots and lines appear and disappear at once, without a reload.
- AC-9: zoom in past level 9; the line gets visibly more detailed (the detailed file is requested once in the network tab); zoom out and it swaps back. Block that request and zoom again: the overview stays and the next zoom retries.
- AC-16: pan and zoom, then mark a stamp from its row; the map's position and zoom do not change and the dot fills in.
- AC-12: click a stamp, "Mark as walked" then "Remove mark" (official place and extra stamp); the popup closes and the dot, stats and list update. With an expired session (delete the auth cookie, then click) the page reloads to sign-in; with the network off the popup shows "Couldn't save" and the button works again.
- AC-12: "Show in list" in a collapsed stage opens the stage, scrolls to the row and flashes it; in fullscreen it leaves fullscreen first.
- AC-13: with extra stamps off, press 📍 on an extra stamp's row; the extra-stamps layer switches on and the map flies there (zoom >= 12).
- AC-14: with restaurants on, hover one (name and distance) and click it (pinned popup with an "Open on etteremhet.hu" link that opens in a new tab).
