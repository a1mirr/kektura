# 0002: Stamping: server actions and stamp buttons

Status: Done
Owner code: `src/app/[locale]/dashboard/actions.ts`, `src/lib/action-result.ts`,
`src/lib/use-stamp-action.ts`, `src/components/ActionButton.tsx` (+ `StampButton`, `StageStampButton`,
`ExtraStampButton`), the stamp popup in `src/components/trail-map/stampPopups.ts`

## Goal

Let a signed-in user mark official places and extra stamps as stamped or not, safely (only their
own rows) and with clear feedback when something goes wrong.

## Behaviour

### Server actions

`setPlacesStamped(placeKeys, stamped)` and `setExtraStamped(extraId, stamped)` return an
`ActionResult`: `{ ok: true }` or `{ ok: false, reason: "unauthorized" | "failed" }`.

- **AC-1**: Invalid input fails without touching the database: no keys, more than 200 keys, a
  non-string or over-long (> 64) key, a non-boolean flag, a non-integer extra id.
- **AC-2**: Without a signed-in user the result is `unauthorized` and nothing is written.
- **AC-3**: Stamping a place writes one `user_stamps` row per variant of every given place, for the
  signed-in user, with ON CONFLICT DO NOTHING (re-stamping keeps the original `stamped_on`). An optional
  `date` is the `stamped_on` of rows that are *created* (spec 0016 AC-1, AC-3). The dashboard is revalidated.
- **AC-4**: Unstamping deletes only the signed-in user's rows for every variant of the given places.
- **AC-5**: Place keys that match no checkpoint fail without writing.
- **AC-6**: A database error (read or write) gives `failed` and nothing is revalidated.
- **AC-7**: The actions never throw, even when creating the client or reading the session throws
  (a thrown error would reach the client as an opaque message).
- **AC-8**: Extra stamps follow the same rules as official places (ON CONFLICT DO NOTHING; an optional `date` for new rows) and are unstamped by deleting only the user's row. They never count towards the 161 places. Their dates are edited by `setExtraStampDate`, which needs the UPDATE policy of migration 0007 (spec 0016 AC-4).

Row-level security (`supabase/migrations`) is the real boundary: every user-table policy is
`to authenticated` with `(select auth.uid()) = user_id`.

### Buttons and popup

- **AC-9**: A stamp button is disabled while its action runs.
- **AC-10**: `failed`, or an action that rejects (network error), shows "Couldn't save, try again."
  next to the button (in the map popup: inside the popup, which stays open).
- **AC-11**: `unauthorized` refreshes the page instead, which redirects to sign-in (0005).
- **AC-12**: A stamped place or extra stamp shows a date field next to the action button; how it saves, and how dates are validated and edited, is spec 0016. (The first version saved on every change, which broke typing.)

## Out of scope

Notes; photo uploads.

## Coverage

| AC | Test |
| --- | --- |
| AC-1 ... AC-8 | `src/app/[locale]/dashboard/actions.test.ts` |
| AC-3, AC-4 end to end (real database, RLS) | `e2e/stamping.spec.ts` |
| AC-12 | spec 0016 |
| AC-9, AC-10, AC-11 (buttons) | `src/components/ActionButton.test.tsx` |
| AC-10, AC-11 (map popup) | manual: map click on a stamp, "Mark as walked" with the network offline / after signing out in another tab |
| RLS | manual: Supabase advisors (`get_advisors`) clean; policies in `0006_rls_initplan.sql` |
