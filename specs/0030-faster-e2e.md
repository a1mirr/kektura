# 0030: Faster end-to-end tests

Status: Accepted
Owner code: `e2e/helpers.ts`, `e2e/auth.spec.ts`, `.github/workflows/ci.yml`

## Goal

The E2E suite (68 tests, spec 0006) is the slowest part of every pull request. Cut the work that every test
repeats, and the setup time of the CI job, without making the suite less faithful: the sign-in form itself
stays covered, and nothing is skipped.

## Behaviour

- **AC-1**: `signInAsNewUser` and `signInWithEmail` (`e2e/helpers.ts`) sign in by posting to `POST
  /auth/test-login` (the route the dummy form submits to, spec 0006 AC-3) with the page's request context, then
  open `/en/dashboard`. They do not load the landing page or fill in the form. The session cookies the route
  sets end up in the browser context, so the dashboard is rendered once, as a signed-in page. If the route does
  not answer with a redirect to the dashboard (the account was refused), the helper fails with a clear message
  instead of a timeout.
- **AC-2**: One E2E test still signs in through the real dummy form (landing page, email field, "Sign in as test
  user" button) and ends on the dashboard, so the form and its hydration-free POST stay covered
  (`signInThroughForm` in `e2e/helpers.ts`, used by `e2e/auth.spec.ts`).
- **AC-3**: The `e2e` job of `.github/workflows/ci.yml` restores two caches before it needs them: Playwright's
  browser download (`~/.cache/ms-playwright`, keyed by the locked `@playwright/test` version) and Next's
  incremental build cache (`.next-e2e/cache`, keyed by `package-lock.json` and the source files, with a
  fallback to the newest cache of the lockfile). A cache miss only makes the job slower, never fails it.
- **AC-4**: The job reports the slowest tests, so the next round of speed-ups starts from numbers: Playwright's
  `list` reporter is joined by `json` in CI (`PLAYWRIGHT_JSON_OUTPUT_NAME`), and a final step prints the ten
  slowest tests to the job summary. It runs even when the suite failed.

## Out of scope

Changing the app, e.g. a `data-hydrated` marker to replace the click-until-it-sticks loops, or sharding and
raising the worker count. Both need measurements from AC-4 first. Replacing the fixed waits that prove "nothing
else is sent" (`e2e/stamp-dates.spec.ts`). Caching the Supabase Docker images.

## Notes

- The route needs no browser: Playwright's `page.request` shares cookies with the page's context, so a POST
  with `maxRedirects: 0` leaves the session in the context and the 303 is not followed (following it would
  render the dashboard a second time).
- `e2e/auth.spec.ts` already posts to the route for the invalid-email case, which shows the pattern works.

## Coverage

| AC | Test |
| --- | --- |
| AC-1 | every E2E test; `e2e/auth.spec.ts` ("AC-1: the helper's sign-in opens the dashboard with the session cookies") |
| AC-2 | `e2e/auth.spec.ts` ("0006 AC-3, AC-5 + 0030 AC-2") |
| AC-3 | manual: the `e2e` job log of a second run on the same lockfile shows "Cache restored" for both caches |
| AC-4 | `tests/slowest-tests.test.ts` (the table); manual: the job summary of a CI run shows it |
