# 0023: Feature flags

Status: Draft
Owner code: `src/lib/feature-flags.ts`, `supabase/migrations/0009_feature_flags.sql`

## Goal

Let unfinished or risky features (the restaurants layer, friends in spec 0024) be merged and deployed to
production while staying invisible, then be switched on for the developer first, then for chosen testers,
then for everyone, without a redeploy (the droplet is small and a deploy takes minutes). A flag is
temporary: when a feature is live for everyone, its flag and checks are deleted.

## Behaviour

### Declaring a flag

- **AC-1**: Every flag is declared once in a registry in `src/lib/feature-flags.ts`: a key (kebab-case), a
  one-line description and a default (`off` unless stated). The key type is derived from the registry, so
  asking for an undeclared flag fails typecheck.
- **AC-2**: A flag has one of three modes: `off` (nobody), `allowlist` (only the listed users) or `on`
  (everybody, signed out included). A flag with no stored mode uses the registry default.

### Resolving a flag

- **AC-3**: Given a flag's mode, its allowlist and the viewer (a user id or signed out), a pure function
  `isEnabled` returns the answer: `on` is true for everyone, `allowlist` is true only for a listed user id,
  `off` is false for everyone, a missing row falls back to the default. Stored keys that are not in the
  registry are ignored.
- **AC-4**: Flags are resolved on the server once per request (React `cache`) and handed to client
  components as plain booleans in props. The browser never receives the flag tables, other users' ids or
  flags that are off for the viewer.

### A flag that is off is really off

- **AC-5**: When a flag is off for the viewer: the feature's pages answer 404, its server actions return a
  `disabled` result without touching the database, and its links, buttons and map layers are not
  rendered. Hiding a button alone does not count.
- **AC-6**: Turning a flag on or off takes effect on the next request, with no deploy and no cache to clear.

### Storage and access

- **AC-7**: Two tables hold the state: `feature_flags (key primary key, mode)` and
  `feature_flag_users (key, user_id)` (the allowlist; deleting the account removes its rows). Both have row
  level security enabled and no policy for `anon` or `authenticated`, so nothing can read or write them
  through the public API.
- **AC-8**: The app reads them through `public.feature_flags_for_me()`, a `security definer` function (empty
  `search_path`) that returns only the keys that are enabled for `auth.uid()` (or, signed out, the keys
  whose mode is `on`). Its execution is granted to `anon` and `authenticated` only.
- **AC-9**: Flags are changed by the developer in the Supabase dashboard or through a migration; there is no
  admin screen.

### Failure

- **AC-10**: When the lookup fails, every flag falls back to its registry default (so a new feature stays
  off), the page still renders, and one `[feature-flags]` line is logged without user ids or other data
  (spec 0008's rules).

### Tests

- **AC-11**: E2E tests can turn a flag on for the test user through the local database
  (`setFeatureFlag` in `e2e/helpers.ts`), and one E2E test per flag checks both states (spec 0006).

## Out of scope

An admin screen; percentage rollouts or A/B experiments; a "labs" switch users flip themselves in
settings; flags for build-time or environment settings (those stay environment variables); per-flag
analytics.

## Open questions

- "Like for restaurants": is the restaurants layer (data from etteremhet.hu, see spec 0019) the first flag
  you have in mind? Then the registry starts with `restaurants` and the friends feature (spec 0024), and
  this spec only builds the mechanism, not the restaurants feature.
- Modes: is `off` / `allowlist` / `on` enough (recommended), or do you want groups of testers or
  percentages?
- Storage: database tables (recommended: changing a flag needs no deploy, and the allowlist is per user)
  or an environment variable on the server (simpler, but a change means editing `.env.local` on the
  droplet and restarting PM2, and there is no per-user list)?
- Do you want a visible marker (a small "beta" badge) on features that are on only for an allowlist, so
  testers know they are looking at something unfinished?

## Notes

- A flag that is `on` for everybody has done its job: remove the flag, its checks and its rows in the same
  pull request that makes the feature permanent. The registry should stay short.
- Next 16: read `node_modules/next/dist/docs/` for `notFound()` in route handlers and for how
  request-scoped caching behaves with the proxy before building the resolver.
- Server actions must not trust the page: they check the flag themselves (AC-5), because anyone can call an
  action without opening the page.

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2, AC-3 | planned: `src/lib/feature-flags.test.ts` |
| AC-4, AC-10 | planned: `src/lib/feature-flags.test.ts` (resolver with a mocked client) |
| AC-5, AC-6, AC-11 | planned: `e2e/feature-flags.spec.ts` |
| AC-7, AC-8 | planned: `tests/feature-flags-migration.test.ts` and the Supabase advisors after applying |
| AC-9 | manual: change a flag in the dashboard and reload |
