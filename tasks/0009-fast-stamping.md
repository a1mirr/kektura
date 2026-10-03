# 0009: Fast stamping: cached reference data, instant button feedback

Status: Done
Specs: [0002](../specs/0002-stamping.md) AC-13 to AC-16 (this task was written as spec 0009; its behaviour now lives there)

## Goal

Every stamp click re-rendered the whole dashboard, which re-fetched 220 checkpoints and 72 extra stamps from the
database although they only change when the seeds are regenerated. On a phone with poor signal on the trail, the
button also gave no feedback until the server answered. Make stamping feel instant and the re-render cheaper.

## Done when

- [x] The reference data is read through a cookie-less client and cached on the server (was 0009 AC-1, now 0002 AC-15)
- [x] The user's stamps are never cached across users (was AC-2, now 0002 AC-16)
- [x] A stamp button flips to the new state at once and back on failure (was AC-3, now 0002 AC-13)
- [x] Stats, counters and the map still come from the server's answer (was AC-4, now 0002 AC-14)
- [x] Everything that worked before still works: all unit tests and the E2E suite pass (was AC-5)

## Spec changes

The five acceptance criteria of the original spec moved into spec 0002 as AC-13 to AC-16 (AC-5, "nothing else
changed", is not behaviour and was dropped). Spec 0002's notes carry the implementation notes below.

## Notes

- Use the caching API that Next 16 documents, without switching the whole app into a different rendering mode. If
  the only documented option had needed an app-wide flag (`cacheComponents`), stop and report.
- **Caching API.** `unstable_cache` (`next/cache`): `use cache` needs the app-wide `cacheComponents` flag, which
  this change did not enable. The cached function is `getReferenceData` in `src/lib/dashboard-data.ts`.
- **`refresh()` replaced `revalidatePath` in the stamp actions.** `unstable_cache` entries carry the rendering
  page's implicit path tag, so `revalidatePath("/[locale]/dashboard")` expired the reference data on every stamp
  (measured: 17 reference reads for 17 stamp actions). `refresh()` re-renders the page in the action's response
  without expiring any cache.
- Out of scope then: offline stamping and a queue of pending stamps; optimistic stats.

### Measurements

Local Docker Supabase, production build on `next start` (`.next-e2e`), headless Chromium, one signed-in user
stamping and unstamping 8 places twice (16 clicks per run, 3 runs per variant); another agent's E2E run shared the
machine for part of it, so absolute numbers are noisy. `next start` prints no request lines, so "server time" is
the time of the action's `POST /en/dashboard` from the browser (request start to request finished), "label flip"
is click until the button shows its new label.

| | Before | After |
| --- | --- | --- |
| `POST /en/dashboard` (stamp action, median per run) | 322, 320, 281 ms | 275, 268, 287 ms (and 282 with a cold cache) |
| Click to new label (median per run) | 856, 860, 366 ms (typically 350 or 860) | 37, 39, 35 ms |
| Reference-data reads from the database | 2 per render | 1 per day (1 read for 33 renders after clearing the cache) |

The optimistic button is the clear win. The server time barely moves here because the local database answers in a
few milliseconds; the two removed queries cost more on the production database over the network, which was not
measured (no production access in this task).
