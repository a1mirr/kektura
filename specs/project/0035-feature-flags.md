# 0035: Feature flags

Status: Done
Owner code: `src/lib/feature-flags.ts`, `src/lib/feature-flags-server.ts`, `supabase/migrations/0060_feature_flags.sql`,
`e2e/feature-flags.spec.ts`, `e2e/helpers.ts`, `playwright.config.ts`

## Goal

An unfinished or risky feature can be merged and deployed to production while staying invisible, then be switched on
for the developer, for chosen testers and for everybody, without a deploy (the server is small and a deploy takes
minutes). A flag is temporary: once its feature is live for everyone, the flag, its checks and its rows are deleted.
Which flags exist is declared in code; how each one is switched is stored in the database.

## Behaviour

### Declaring a flag

- **AC-1**: Every flag is declared once in the registry `FLAGS` of `src/lib/feature-flags.ts`: a kebab-case key, a
  one-line description and a default mode (`off` unless stated). The type of a flag key is derived from the registry,
  so asking for a flag that is not declared fails typecheck.
- **AC-2**: A flag has one of three modes: `off` (nobody), `allowlist` (only the users listed for it) or `on` (everybody,
  signed-out visitors included). A flag with no stored row has its registry default.

### Resolving a flag

- **AC-3**: Given a flag's stored mode and whether the viewer is on its allowlist, the pure function `isEnabled`
  answers: `on` is true for everybody, `allowlist` only for a listed viewer, `off` for nobody (an entry on the list of
  an `off` flag changes nothing). `resolveFlags` gives every declared flag for one viewer: a flag with no stored row, or
  with a mode the code does not know, has its default, and stored keys that are not declared are ignored.
- **AC-4**: The server reads the flags once per request (React `cache`; `flagOn` in `src/lib/feature-flags-server.ts`)
  as the viewer, and pages and actions use the plain boolean. The browser never receives the flag tables, anybody's id
  or a flag that is off for the viewer. Reading the session makes a page that asks for a flag render per request, so
  a build never freezes an answer.

### A flag that is off is off

- **AC-5**: While a flag is off for the viewer, the feature's pages answer 404, its server actions return a `disabled`
  result without touching the feature's data (they check the flag themselves, before the session), and its links,
  buttons and text are not rendered: hiding a button alone does not count.
- **AC-6**: Switching a flag takes effect on the next request: no deploy, no restart and no cache to clear.

### Storage and access

- **AC-7**: Two tables hold the state: `feature_flags (key, mode)` (the key is kebab-case, the mode one of the three)
  and `feature_flag_users (key, user_id)`, the allowlists. Both have row level security enabled and no policy, and
  `anon` and `authenticated` have no privilege on them, so neither can read or write them through the public API.
- **AC-8**: The app reads the state with `public.feature_flags_for_me()`, a `security definer` function with an empty
  `search_path` that returns, for each stored flag, its key, its mode and whether the caller (`auth.uid()`; nobody when
  signed out) is on its allowlist: never another user's id. Its execution is granted to `anon` and `authenticated`
  and not to `public`.
- **AC-9**: When the lookup fails (a database error, or a thrown error even while making the client), every flag has its
  default, so a new feature stays off, the page still renders and one `[feature-flags]` line is logged with the error's
  code and message and nothing else (spec 0008's rules).
- **AC-10**: The developer switches a flag in the Supabase dashboard (a row of `feature_flags`, rows of
  `feature_flag_users` for an allowlist) or in a migration; there is no admin screen.
- **AC-12**: Deleting an account removes its allowlist entries.
- **AC-13**: Every declared flag has a row in `feature_flags` (a migration inserts it with the flag), so its allowlist
  can be filled.

### Tests

- **AC-11**: End-to-end tests switch a flag in the local database with `setFeatureFlag` (`e2e/helpers.ts`). Flags are
  global, so the tests that switch a declared one are `e2e/feature-flags.spec.ts`, which is its own Playwright
  project (`flags`) that starts after the others have finished, runs its tests one after the other and leaves the
  flag as the other tests expect it (`on`). They check each state of `friends`, for a signed-in user, a listed user and
  a signed-out visitor.

## Out of scope

An admin screen; percentage rollouts or A/B experiments; a switch users flip themselves; flags for build-time or
environment settings (those stay environment variables); per-flag analytics; a visible "beta" marker.

## Notes

- Flags today: `friends` (spec 0024; `on` in production, which the migration that adds the tables records) and
  `restaurants` (declared for the restaurants layer, which is not built; `off`).
- `feature_flags_for_me()` returns the mode and a `listed` bit instead of the enabled keys, so the rules of AC-3 live
  in one place that unit tests reach without a database. The mode of a stored flag is not secret.
- A flag that is on for everybody has done its job: delete the flag, its checks and its rows in the pull request that
  makes the feature permanent. The registry should stay short.
- The feature flag tables are not part of the weekly backup (spec 0012 AC-1): migrations seed them and the developer
  sets them.
- Run only the flags tests with `npx playwright test --project flags --no-deps`.

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2, AC-3, AC-9 | `src/lib/feature-flags.test.ts`, `src/lib/feature-flags-server.test.ts` |
| AC-4, AC-8 (the call), AC-9 (the log line) | `src/lib/feature-flags-server.test.ts`, `src/lib/log.test.ts` |
| AC-5 | `src/app/[locale]/(pages)/friends/actions.test.ts` (`disabled` before anything is touched), `e2e/feature-flags.spec.ts` (the pages, the link and the paragraph, and an action called while the flag turns off) |
| AC-6, AC-11 | `e2e/feature-flags.spec.ts` |
| AC-7, AC-8, AC-12, AC-13 | `tests/feature-flags-database.test.ts` (against the local database, run by CI's end-to-end job) |
| AC-10 | manual (the Supabase dashboard is a web UI): change a row of `feature_flags` there and reload the page. Last checked: never recorded. |
