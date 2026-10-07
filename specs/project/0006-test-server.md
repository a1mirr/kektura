# 0006: Test server with dummy login, and end-to-end tests

Status: Done
Owner code: `supabase/config.toml`, `scripts/test-env.mjs`, `scripts/lib/test-server-env.mjs`, `src/lib/test-login.ts`,
`src/app/auth/test-login/route.ts`, `src/components/TestLoginForm.tsx`, `src/components/TestBanner.tsx`,
`playwright.config.ts`, `e2e/` (for AC-10 to AC-12: `e2e/mobile.spec.ts`, `e2e/accessibility.spec.ts`, `e2e/accessibility.ts`,
`e2e/accessibility-allowlist.ts`)

## Goal

A second environment next to production where anyone (and the E2E tests) can use the app without a
Google account and without touching real data. Production keeps Google sign-in only.

| | Production | Test server |
| --- | --- | --- |
| Database + auth | Supabase cloud project | Local Supabase in Docker (`supabase/config.toml`), same migrations and seeds |
| App | `npm run dev` (port 3000) / `npm run build` | `npm run dev:test` (port 3001, separate `.next-test` build dir) |
| Sign-in | Google | Google button + dummy login (any email) |

## Behaviour

- **AC-1**: `npm run testdb:start` starts the local Supabase with every migration in
  `supabase/migrations` and both seeds (220 current checkpoints = 161 places, plus the retired stamps, 72 extra stamps);
  `npm run testdb:reset` rebuilds it from scratch; `npm run testdb:stop` stops it.
- **AC-2**: `npm run dev:test` serves the app against the local Supabase (URL and keys read from
  `supabase status`), with the dummy login switched on. It can run next to the normal dev server.
- **AC-3**: On the test server the landing page shows a dummy login: an email field (pre-filled with
  `tester@kektura.test`) and "Sign in as test user". Any valid email signs in with a fixed password,
  creating the account on first use, and lands on the dashboard (or on the page of an optional `next` path, e.g. an invite link, spec 0024). An invalid email shows the sign-in
  error.
- **AC-4**: The dummy login exists only when `TEST_LOGIN=1` **and** the Supabase URL points at this
  machine (localhost / 127.0.0.1 / ::1). Otherwise the form is not rendered and `POST
  /auth/test-login` answers 404, so a stray `TEST_LOGIN=1` in production can't open it.
- **AC-5**: Every page of the test server shows a "Test server" banner.
- **AC-6**: `npm run e2e` runs the Playwright suite against a production build of the test server
  (`build:e2e` + `start:e2e`, port 3002, its own build folder, so a manual `dev:test` on :3001 is
  never reused by mistake). Every test signs in as a fresh user, so tests are independent and run
  in parallel, except the tests that switch a declared feature flag for everybody, which run as their own project after the rest, the phone project included (spec 0035 AC-11, AC-10 below). How they sign in is AC-8 and AC-9.
- **AC-7**: The test server never sends feedback to the real Telegram bot. `scripts/test-env.mjs` blanks
  `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` (and the flag commands' `TELEGRAM_WEBHOOK_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`, spec 0035 AC-26) for every server it starts (`dev:test`, `build:e2e`,
  `start:e2e`, CI), even when `.env.local` holds the real bot, so feedback submitted by a manual test
  or an E2E run is only stored in the local database and never sent to the developer's Telegram
  (spec 0017 AC-4 sends only when both are set).
- **AC-8**: The E2E helpers `signInAsNewUser` and `signInWithEmail` (`e2e/helpers.ts`) sign in by posting to `POST
  /auth/test-login` (the route the dummy form submits to, AC-3) with the page's request context, then open
  `/en/dashboard`. They do not load the landing page or fill in the form. The session cookies the route sets end up
  in the browser context, so the dashboard is rendered once, as a signed-in page. If the route does not answer with
  a redirect to the dashboard (the account was refused), the helper fails with a clear message instead of a timeout.
- **AC-9**: At least one E2E test signs in through the real dummy form (landing page, email field, "Sign in as test
  user" button) and ends on the dashboard, so the form and its hydration-free POST stay covered
  (`signInThroughForm` in `e2e/helpers.ts`, used by `e2e/auth.spec.ts`).
- **AC-10**: The suite also runs at a phone's width. Playwright has a second project, `mobile` (Chromium, 375 x 812, touch,
  mobile emulation; 375 px is the narrowest width spec 0036 promises), that runs only the tests tagged `@mobile`, and the
  desktop project `chromium` runs everything else, so no test runs twice. The tagged tests (`e2e/mobile.spec.ts`) cover the
  landing page with the dummy sign-in, stamping a place on the dashboard, changing the dates of several stamps at once (the bar at 375 and 320 px), the stage list, the map (a section of the dashboard,
  not a page of its own: going fullscreen and leaving it), the Friends page (saving the name), the stats page (a long walk scrolls inside the chart's frame, a month's tooltip is opened and closed with taps) and the account page (signing
  out). Each one asserts that its page does not scroll sideways (`expectNoSidewaysScroll` in `e2e/helpers.ts`, the check
  `e2e/layout.spec.ts` uses too), that the page's main action is visible, lies inside the window and is at least 24 px high
  and wide (44 px where a spec promises it: the sign-out button, spec 0014 AC-16, and the name's Save button, spec 0024
  AC-20), and that tapping it does what it should. The feature-flag project starts only after both projects (AC-6).
- **AC-11**: The main pages are checked with axe (`@axe-core/playwright`, `e2e/accessibility.spec.ts`), each at a desktop width
  (1280 x 800) and at the phone width (375 x 812): the landing page in every language, the dashboard (every stage open, one place
  stamped, the map drawn), the dashboard in its "Change dates" mode (one stamp chosen and a date typed), the stats page (six months drawn, one of them empty), the account page, the Friends page and the Changelog page. The rules are the WCAG 2.0, 2.1 and 2.2
  success criteria of levels A and AA, all of them at both widths except the colour contrast of the dashboard, which is checked at
  the desktop width only (the colours do not change with the width, and the rule is half of the time axe takes on that page). A finding of impact `serious` or `critical` that the allow-list (AC-12) does not name fails
  the test of its page, with the rule, the width and the elements; findings of lower impact are attached to the test as
  annotations and do not fail it. Only the page as it is when it has loaded is scanned: not what opens on a click (the map's
  popups, the confirmation of deleting an account).
- **AC-12**: The serious and critical violations that exist and are not fixed yet are listed in one allow-list
  (`e2e/accessibility-allowlist.ts`): the rule, the page, optionally the width, the reason and the task that fixes it. The list
  can only shrink: the test of a page fails when an entry for that page no longer fires (at the width it names, or at either
  width when it names none), so the entry has to be deleted, and a new violation can only be fixed, never listed silently. Every
  entry names a page that is scanned (checked in `e2e/accessibility.spec.ts`) and gives a reason (checked by `tests/accessibility-allowlist.test.ts`, which also tests how
  findings are judged against the list). The list is empty when no violation is known.

## Notes

- The route needs no browser: Playwright's `page.request` shares cookies with the page's context, so a POST with
  `maxRedirects: 0` leaves the session in the context and the 303 is not followed (following it would render the
  dashboard a second time).

E2E against `next dev` is unreliable: each stamp re-renders the whole dashboard, which takes 15-20 s
in dev mode with 6 parallel workers (about 1 s alone), longer than the assertions wait. The
production build answers in well under a second.

## Out of scope

A hosted test deployment (it would need a second Supabase project and a host; AC-4 would then need
an explicit allowance for that project's URL). Tests of the map canvas (WebGL clicks). Browsers other than Chromium, a real phone,
and a width below 375 px.

## Coverage

| AC | Test |
| --- | --- |
| AC-1 | `tests/database-rules.test.ts` (the migrations and both seeds leave 220 current checkpoints, 161 places, one retired stamp and 72 extra stamps); CI's `e2e` job starts the stack with `supabase start` and every E2E run uses it |
| AC-2 | manual (it starts a dev server): `npm run testdb:start`, `npm run dev:test`, open http://localhost:3001. Last checked: never recorded. |
| AC-3 | `e2e/auth.spec.ts` |
| AC-4 | `src/lib/test-login.test.ts`; `tests/smoke-test.test.ts` and the deploy workflow's smoke test (spec 0026 AC-8): after every deploy a POST to `/auth/test-login` on the public address must answer 404 |
| AC-5 | `e2e/auth.spec.ts` |
| AC-6 | `playwright.config.ts`, `e2e/helpers.ts` |
| AC-8 | `e2e/auth.spec.ts` ("AC-8: the helper's sign-in leaves the session cookies…", which fails if no session reaches the browser); every other E2E test signs in through the helper. Not asserted: that the landing page isn't loaded, and the "refused" error message (both read from `e2e/helpers.ts`) |
| AC-9 | `e2e/auth.spec.ts` ("AC-3, AC-5, AC-9") |
| AC-7 | `tests/test-server-env.test.ts` (the real Next env loader, with a `.env.local` that holds a bot; and that `scripts/test-env.mjs` builds its environment with `testServerEnv`) |
| AC-10 | `e2e/mobile.spec.ts` (the first test checks that the project is a 375 px touch screen; the rest are the pages and actions named in the AC), `playwright.config.ts` (the projects) |
| AC-11 | `e2e/accessibility.spec.ts` (one test per page, both widths). Not covered by axe, and not tested: how a screen reader reads the pages, focus order and keyboard use, and what opens on a click. manual (axe finds roughly a third of accessibility problems, not all): walk the landing page, the dashboard, the account page and the stats page (the month bars are a custom widget: buttons in a group with arrow-key movement) with a keyboard only and with a screen reader (NVDA or VoiceOver). Last checked: never recorded. |
| AC-12 | `tests/accessibility-allowlist.test.ts` (an unlisted serious or critical finding fails, a listed one passes, an entry that no longer fires is stale, an entry covers its own page and width only, minor and moderate findings are not enforced, every real entry has a reason), `e2e/accessibility.spec.ts` (every entry names a scanned page; each page's test fails on a stale entry) |
