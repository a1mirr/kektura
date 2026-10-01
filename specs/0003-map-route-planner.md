# 0003: Map lines and the route planner

Status: Done
Owner code: `src/lib/route-geometry.ts`, `src/lib/route-stats.ts`, `src/components/TrailMap.tsx`

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

## Out of scope

Routing off the trail; restaurant and extra-stamp layers (display only, no rules).

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2, AC-3 (line) | `src/lib/route-geometry.test.ts` |
| AC-2 (toggle), AC-3 (fit) | manual: dashboard map |
| AC-4 ... AC-8 | `src/lib/route-stats.test.ts` |
| Table totals | `tests/trail-data.test.ts` (0004 AC-6) |
