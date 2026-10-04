# 0030: Faster end-to-end tests

Status: Done
Specs: [0006](../specs/0006-test-server.md) AC-8, AC-9; [0007](../specs/0007-ci.md) AC-6, AC-7 (this task was written as spec 0030; its behaviour now lives there)

## Goal

The E2E suite (about 70 tests, spec 0006) was the slowest part of every pull request. Cut the work that every test
repeats, and the setup time of the CI job, without making the suite less faithful: the sign-in form itself stays
covered, and nothing is skipped.

## Done when

- [x] The sign-in helpers post to the dummy login route instead of loading the landing page and filling in the form (was 0030 AC-1, now 0006 AC-8)
- [x] At least one test still signs in through the real form (was AC-2, now 0006 AC-9)
- [x] The `e2e` job restores the browser and Next build caches and drops the cached reference data (was AC-3, now 0007 AC-6)
- [x] The job reports the ten slowest tests in its summary (was AC-4, now 0007 AC-7)
- [x] Three workers in CI: tried and dropped (was AC-5, see Notes)

## Spec changes

AC-1 and AC-2 moved into spec 0006 (AC-8, AC-9) and AC-3 and AC-4 into spec 0007 (AC-6, AC-7). AC-5 was removed;
the measurement behind it is in spec 0007's notes.

## Notes

- Out of scope then: changing the app (for example a `data-hydrated` marker to replace the click-until-it-sticks
  loops), sharding (task 0031, not built), replacing the fixed waits that prove "nothing else is sent"
  (`e2e/stamp-dates.spec.ts`), caching the Supabase Docker images.
- The route needs no browser: Playwright's `page.request` shares cookies with the page's context, so a POST with
  `maxRedirects: 0` leaves the session in the context and the 303 is not followed.
- Three workers were slower on the 2-core runner (run 37129709176): the test phase took 162 s against 143 s on the
  single worker Playwright picks there, and single tests got 2 to 4 times slower.
- Measured in CI (the E2E job, single worker on the 2-core runner). Run-to-run variation is large, about 30 s:

  | Run | Whole job | `npm run e2e` step (build + tests) |
  | --- | --- | --- |
  | `main`, run 56 (before) | 4 m 56 s | 171 s |
  | caches restored, run 37130160394 | 4 m 00 s | 128 s |
  | final workflow, run 37130610633 | 4 m 16 s | 145 s |
  | final workflow, run 37130613212 (pull request event) | 4 m 52 s | 179 s |

  Other runs of `main` that day took 5 to 5.5 minutes in total. The net saving is roughly 30 to 60 s of about 5
  minutes: the caches are most of it (build 27 s to 13 s, browser install 30 s to 17 s); the sign-in change alone
  is within noise (about 6 s over 67 tests).
