# 0030: Faster end-to-end tests

Status: Done
Owner code: `e2e/helpers.ts`, `e2e/auth.spec.ts`, `.github/workflows/ci.yml`, `scripts/slowest-tests.mjs`,
`playwright.config.ts`

## Goal

The E2E suite (about 70 tests, spec 0006) is the slowest part of every pull request. Cut the work that every test
repeats, and the setup time of the CI job, without making the suite less faithful: the sign-in form itself
stays covered, and nothing is skipped.

## Behaviour

- **AC-1**: `signInAsNewUser` and `signInWithEmail` (`e2e/helpers.ts`) sign in by posting to `POST
  /auth/test-login` (the route the dummy form submits to, spec 0006 AC-3) with the page's request context, then
  open `/en/dashboard`. They do not load the landing page or fill in the form. The session cookies the route
  sets end up in the browser context, so the dashboard is rendered once, as a signed-in page. If the route does
  not answer with a redirect to the dashboard (the account was refused), the helper fails with a clear message
  instead of a timeout.
- **AC-2**: At least one E2E test still signs in through the real dummy form (landing page, email field, "Sign in as test
  user" button) and ends on the dashboard, so the form and its hydration-free POST stay covered
  (`signInThroughForm` in `e2e/helpers.ts`, used by `e2e/auth.spec.ts`).
- **AC-3**: The `e2e` job of `.github/workflows/ci.yml` restores two caches before it needs them: Playwright's
  browser download (`~/.cache/ms-playwright`, keyed by the locked `@playwright/test` version) and Next's
  incremental build cache (`.next-e2e/cache`, keyed by `package-lock.json` and the source files, with a
  fallback to the newest cache of the lockfile). The Next cache folder also holds the server's cached reference data (spec 0009), which would hide a changed seed
  or migration, so the job deletes `.next-e2e/cache/fetch-cache` after restoring. A cache miss only makes the job
  slower, never fails it.
- **AC-4**: The job reports the slowest tests, so the next round of speed-ups starts from numbers: Playwright's
  `list` reporter is joined by `json` in CI (`PLAYWRIGHT_JSON_OUTPUT_NAME`), and a final step prints the ten
  slowest tests to the job summary. It runs even when the suite failed.

- **AC-5**: *Removed.* It ran the CI suite on 3 workers. Measured on the 2-core runner (run 37129709176): the
  test phase took 162 s against 143 s on the single worker Playwright picks there, and single tests got 2-4 times
  slower, because Next, Postgres and Chromium already use both cores. More workers do not help on this runner;
  faster is only possible with less work per test, more cores (a larger runner) or splitting across jobs.

## Out of scope

Changing the app, e.g. a `data-hydrated` marker to replace the click-until-it-sticks loops, or sharding. Both
need measurements from AC-4 first. Replacing the fixed waits that prove "nothing
else is sent" (`e2e/stamp-dates.spec.ts`). Caching the Supabase Docker images.

## Notes

- The route needs no browser: Playwright's `page.request` shares cookies with the page's context, so a POST
  with `maxRedirects: 0` leaves the session in the context and the 303 is not followed (following it would
  render the dashboard a second time).
- `e2e/auth.spec.ts` already posts to the route for the invalid-email case, which shows the pattern works.

- Measured in CI (the E2E job, single worker on the 2-core runner). Run-to-run variation is large, about 30 s:

  | Run | Whole job | `npm run e2e` step (build + tests) |
  | --- | --- | --- |
  | `main`, run 56 (before) | 4 m 56 s | 171 s |
  | caches restored, run 37130160394 | 4 m 00 s | 128 s |
  | final workflow, run 37130610633 | 4 m 16 s | 145 s |
  | final workflow, run 37130613212 (pull request event) | 4 m 52 s | 179 s |

  Other runs of `main` that day took 5 to 5.5 minutes in total. So the net saving is roughly 30 to 60 s of about
  5 minutes: the caches are most of it (build 27 s to 13 s, browser install 30 s to 17 s); the sign-in change alone
  is within noise (about 6 s over 67 tests). Running the suite on 3 workers was slower (AC-5).

## Coverage

| AC | Test |
| --- | --- |
| AC-1 | `e2e/auth.spec.ts` ("0030 AC-1: the helper's sign-in leaves the session cookies…", which fails if no session reaches the browser); every other E2E test signs in through the helper. Not asserted: that the landing page isn't loaded, and the "refused" error message (both read from `e2e/helpers.ts`) |
| AC-2 | `e2e/auth.spec.ts` ("0006 AC-3, AC-5 + 0030 AC-2") |
| AC-3 | manual: the `e2e` job log of a second run on the same lockfile shows "Cache restored" for both caches, and no `fetch-cache` folder is left after the "Drop the restored reference-data cache" step |
| AC-4 | `tests/slowest-tests.test.ts` (the table); manual: the job summary of a CI run shows it |
| AC-5 | Removed |
