# 0009: Fast stamping: cached reference data, instant button feedback

Status: Accepted
Owner code: `src/app/[locale]/dashboard/page.tsx`, `src/lib/supabase/`, `src/lib/use-stamp-action.ts`,
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
  dashboard only queries the signed-in user's own `user_stamps` and `user_extra_stamps`.
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

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2 | unit test of the data-loading module (mocked clients: reference data via the cached cookie-less path, stamps via the cookie client) |
| AC-3 | `src/components/ActionButton.test.tsx` (label flips while pending, reverts on failure) |
| AC-4, AC-5 | `e2e/stamping.spec.ts` |
