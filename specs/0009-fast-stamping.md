# 0009: Fast stamping: cached reference data, instant button feedback

Status: Done
Owner code: `src/app/[locale]/dashboard/page.tsx`, `src/lib/dashboard-data.ts`, `src/lib/supabase/`,
`src/lib/use-stamp-action.ts`,
`src/components/ActionButton.tsx` (+ `StampButton`, `ExtraStampButton`, `StageStampButton`)

## Goal

Every stamp click re-renders the whole dashboard, which re-fetches 220 checkpoints and 72 extra
stamps from the database although they only change when the seeds are regenerated. On a phone with
poor signal on the trail, the button also gives no feedback until the server answers. Make stamping
feel instant and the re-render cheaper.

## Behaviour

- **AC-1**: The reference data (`checkpoints`, `extra_stamps`; RLS lets everyone read them) is read
  through a cookie-less Supabase client and cached on the server across requests and users, with a
  revalidation time of at most one day and a cache tag that can expire it on demand. Per request, the
  dashboard only queries the signed-in user's own `user_stamps` and `user_extra_stamps`. A failed
  reference read is not cached, and the dashboard shows the localized error boundary (`error.tsx`)
  rather than an empty list.
- **AC-2**: The user's stamps are never cached across users: they keep going through the
  cookie-based client under RLS.
- **AC-3**: Clicking a stamp button flips its label and style to the new state immediately (optimistic)
  while the action runs, and the button stays disabled until it finishes. On `failed` it flips back and
  shows the error (0002 AC-10); on `unauthorized` the page refreshes (0002 AC-11).
- **AC-4**: Stats, the stage counters and the map still update from the server's answer (no optimistic
  maths on the client).
- **AC-5**: Behaviour from specs 0001 and 0002 is unchanged: all their unit tests and the E2E suite pass.

## Out of scope

Offline stamping and a queue of pending stamps (a possible later feature); optimistic stats.

## Notes

- Use the caching API that Next 16 documents (`node_modules/next/dist/docs/`), without switching the
  whole app into a different rendering mode. If the only documented option needs an app-wide flag
  (e.g. `cacheComponents`), stop and report instead of enabling it.
- Measure before and after on the E2E production build: server time of one stamp action, the `POST
  /<locale>/dashboard` line in the `next start` output. Record the numbers here.

## Implementation notes

- **Caching API.** `unstable_cache` (`next/cache`), the documented option for projects without Cache
  Components: `use cache` needs the app-wide `cacheComponents` flag, which this change does not enable. The
  cached function is `getReferenceData` in `src/lib/dashboard-data.ts` (tag `reference-data`, `revalidate`
  86400 s). It reads through `src/lib/supabase/public.ts` (plain `@supabase/supabase-js`, anon key, no
  session). A failed read throws, so an error is never cached as an empty list.
- **`refresh()` replaces `revalidatePath` in the stamp actions.** `unstable_cache` entries also carry the
  rendering page's implicit path tag, so `revalidatePath("/[locale]/dashboard")` expired the reference data
  on every stamp (measured: 17 reference reads for 17 stamp actions). `refresh()` from `next/cache`
  re-renders the page in the action's response without expiring any cache. Behaviour of 0002 is unchanged.
- **Expiring the cache by hand.** The cache is also kept on disk (`.next/cache/fetch-cache`) and survives
  restarts and rebuilds. After changing seeds in production, either wait at most a day or delete that folder
  and restart the app (`deploy/README.md`, "After the seeds change"); nothing calls `revalidateTag(REFERENCE_DATA_TAG, "max")` yet.
- **Optimistic button.** `ActionButton` keeps `useOptimistic(done)` and flips it inside the transition that
  runs the action; React reverts it when the transition ends, so a failure needs no extra code and a success
  shows the server's answer. It takes `doneLabel`/`todoLabel` instead of children so it can show either one.
  The date field of a new stamp still appears only once the server has answered (a consequence of AC-3:
  the date is server data, not part of the optimistic state).

## Measurements

Local Docker Supabase, production build on `next start` (`.next-e2e`), headless Chromium, one signed-in
user stamping and unstamping 8 places twice (16 clicks per run, 3 runs per variant); another agent's
E2E run shared the machine for part of it, so absolute numbers are noisy. `next start` prints no request
lines, so "server time" is the time of the action's `POST /en/dashboard` from the browser (request start to
request finished), "label flip" is click until the button shows its new label.

| | Before | After |
| --- | --- | --- |
| `POST /en/dashboard` (stamp action, median per run) | 322, 320, 281 ms | 275, 268, 287 ms (and 282 with a cold cache) |
| Click to new label (median per run) | 856, 860, 366 ms (typically 350 or 860) | 37, 39, 35 ms |
| Reference-data reads from the database | 2 per render | 1 per day (1 read for 33 renders after clearing the cache) |

The optimistic button is the clear win. The server time barely moves here because the local database
answers in a few milliseconds; the two removed queries cost more on the production database over the
network, which was not measured (no production access in this task).

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2 | `src/lib/dashboard-data.test.ts` (mocked clients: reference data via the cookie-less client under a tag and a one-day revalidation, never cached when the read fails; stamps via the cookie client). That the cache really serves later requests rests on these mocked-options unit tests plus the manual measurement above: to re-check, follow the Measurements procedure (build, `next start`, clear `.next-e2e/cache/fetch-cache`, stamp repeatedly, count reference reads, e.g. with a temporary log in `fetchReferenceData`; expect one) |
| AC-3 | `src/components/ActionButton.test.tsx` (label and style flip while pending, revert on `failed` with the error, revert and refresh on `unauthorized`) |
| AC-4, AC-5 | `e2e/stamping.spec.ts` and the other dashboard E2E specs (stats, counters and map come from the server's answer); `src/app/[locale]/dashboard/actions.test.ts` (the actions call `refresh()`) |
