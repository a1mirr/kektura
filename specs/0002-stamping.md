# 0002: Stamping: server actions, stamp buttons, reference data

Status: Done
Owner code: `src/app/[locale]/dashboard/actions.ts`, `src/lib/action-result.ts`,
`src/lib/use-stamp-action.ts`, `src/components/ActionButton.tsx` (+ `StampButton`, `StageStampButton`,
`ExtraStampButton`), the stamp popup in `src/components/trail-map/stampPopups.ts`,
`src/lib/dashboard-data.ts`, `src/lib/supabase/public.ts`, `src/app/[locale]/dashboard/page.tsx`

## Goal

A signed-in user marks official places and extra stamps as stamped or not, safely (only their own rows), with
clear feedback when something goes wrong, and with buttons that answer at once even on a phone with poor signal.
The dates of stamps are spec 0016.

## Behaviour

### Server actions

`setPlacesStamped(placeKeys, stamped)` and `setExtraStamped(extraId, stamped)` return an
`ActionResult`: `{ ok: true }` or `{ ok: false, reason: "unauthorized" | "failed" }`.

- **AC-1**: Invalid input fails without touching the database: no keys, more than 200 keys, a
  non-string or over-long (> 64) key, a non-boolean flag, a non-integer extra id.
- **AC-2**: Without a signed-in user the result is `unauthorized` and nothing is written.
- **AC-3**: Stamping a place writes one `user_stamps` row per variant of every given place, for the
  signed-in user, with ON CONFLICT DO NOTHING (re-stamping keeps the original `stamped_on`). An optional
  `date` is the `stamped_on` of rows that are *created* (spec 0016 AC-1, AC-3). The dashboard is refreshed with
  `refresh()`, not `revalidatePath` (see the notes).
- **AC-4**: Unstamping deletes only the signed-in user's rows for every variant of the given places.
- **AC-5**: Place keys that match no checkpoint fail without writing.
- **AC-6**: A database error (read or write) gives `failed` and nothing is refreshed.
- **AC-7**: The actions never throw, even when creating the client or reading the session throws
  (a thrown error would reach the client as an opaque message).
- **AC-8**: Extra stamps follow the same rules as official places (ON CONFLICT DO NOTHING; an optional `date` for
  new rows) and are unstamped by deleting only the user's row. They never count towards the 161 places. Their
  dates are edited by `setExtraStampDate`, which needs the UPDATE policy of migration 0007 (spec 0016 AC-4).

Row-level security (`supabase/migrations`) is the real boundary: every user-table policy is
`to authenticated` with `(select auth.uid()) = user_id`.

### Buttons and popup

- **AC-9**: A stamp button is disabled while its action runs.
- **AC-10**: `failed`, or an action that rejects (network error), shows "Couldn't save, try again."
  next to the button (in the map popup: inside the popup, which stays open).
- **AC-11**: `unauthorized` refreshes the page instead, which redirects to sign-in (0005).
- **AC-12**: A stamped place or extra stamp shows a date field next to the action button; how it saves, and how
  dates are validated and edited, is spec 0016 AC-5 to AC-12.
- **AC-13**: Clicking a stamp button flips its label and style to the new state immediately (optimistic) while
  the action runs, and the button stays disabled until it finishes. On `failed` it flips back and shows the
  error (AC-10); on `unauthorized` the page refreshes (AC-11). The date field of a new stamp appears once the
  server has answered: the date is server data, not part of the optimistic state.
- **AC-14**: Stats, the stage counters and the map update from the server's answer: there is no optimistic
  maths on the client.

### Reference data

- **AC-15**: The reference data (`checkpoints`, `extra_stamps`; RLS lets everyone read them) is read through a
  cookie-less Supabase client and cached on the server across requests and users, with a revalidation time of at
  most one day and a cache tag (`reference-data`) that can expire it on demand. Per request, the dashboard only
  queries the signed-in user's own `user_stamps` and `user_extra_stamps`. A failed reference read is not cached,
  and the dashboard shows the localized error boundary (`error.tsx`) rather than an empty list.
- **AC-16**: The user's stamps are never cached across users: they are read through the cookie-based client under
  RLS.

## Out of scope

Notes; photo uploads; offline stamping and a queue of pending stamps; optimistic stats.

## Notes

- **Caching API.** `unstable_cache` (`next/cache`), the documented option for projects without Cache Components:
  `use cache` needs the app-wide `cacheComponents` flag, which the app does not enable. The cached function is
  `getReferenceData` in `src/lib/dashboard-data.ts` (tag `reference-data`, `revalidate` 86400 s). It reads through
  `src/lib/supabase/public.ts` (plain `@supabase/supabase-js`, anon key, no session): never use it for user data.
  A failed read throws, so an error is never cached as an empty list.
- **`refresh()`, not `revalidatePath`, in the actions.** `unstable_cache` entries also carry the rendering page's
  implicit path tag, so `revalidatePath("/[locale]/dashboard")` expired the reference data on every stamp.
  `refresh()` from `next/cache` re-renders the page in the action's response without expiring any cache.
- **Expiring the cache by hand.** The cache is also kept on disk (`.next/cache/fetch-cache`) and survives restarts
  and rebuilds. After changing seeds in production, either wait at most a day or delete that folder and restart
  the app (`deploy/README.md`, "After the seeds change"); nothing calls `revalidateTag(REFERENCE_DATA_TAG, "max")`.
- **Optimistic button.** `ActionButton` keeps `useOptimistic(done)` and flips it inside the transition that runs
  the action; React reverts it when the transition ends, so a failure needs no extra code and a success shows the
  server's answer. It takes `doneLabel`/`todoLabel` instead of children so it can show either one.

## Coverage

| AC | Test |
| --- | --- |
| AC-1 ... AC-8 | `src/app/[locale]/dashboard/actions.test.ts` |
| AC-3, AC-4 end to end (real database, RLS) | `e2e/stamping.spec.ts` |
| AC-9, AC-10, AC-11 (buttons) | `src/components/ActionButton.test.tsx` |
| AC-10, AC-11 (map popup) | manual: map click on a stamp, "Mark as walked" with the network offline / after signing out in another tab |
| AC-12 | spec 0016 (`StampDateInput.test.tsx`, `e2e/stamp-dates.spec.ts`) |
| AC-15, AC-16 | `src/lib/dashboard-data.test.ts` (mocked clients: reference data via the cookie-less client under a tag and a one-day revalidation, never cached when the read fails; stamps via the cookie client). That the cache really serves later requests rests on these mocked-options tests plus a manual check: build, `next start`, clear `.next-e2e/cache/fetch-cache`, stamp repeatedly, count reference reads (a temporary log in `fetchReferenceData`; expect one) |
| AC-13 | `src/components/ActionButton.test.tsx` (label and style flip while pending, revert on `failed` with the error, revert and refresh on `unauthorized`) |
| AC-13 (date field after the answer) | manual: stamp a place on the dashboard; the button flips at once, and the date field appears a moment later, once the server has answered |
| AC-14 | `e2e/stamping.spec.ts` and the other dashboard E2E specs (stats, counters and map come from the server's answer); `actions.test.ts` (the actions call `refresh()`) |
| RLS | manual: Supabase advisors (`get_advisors`) clean; policies in `0006_rls_initplan.sql` |
