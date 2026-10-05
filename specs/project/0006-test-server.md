# 0006: Test server with dummy login, and end-to-end tests

Status: Done
Owner code: `supabase/config.toml`, `scripts/test-env.mjs`, `scripts/lib/test-server-env.mjs`, `src/lib/test-login.ts`,
`src/app/auth/test-login/route.ts`, `src/components/TestLoginForm.tsx`, `src/components/TestBanner.tsx`,
`playwright.config.ts`, `e2e/`

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
  `supabase/migrations` and both seeds (220 checkpoints = 161 places, 72 extra stamps);
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
  in parallel, except the tests that switch a declared feature flag for everybody, which run as their own project after the rest (spec 0035 AC-11). How they sign in is AC-8 and AC-9.
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

## Notes

- The route needs no browser: Playwright's `page.request` shares cookies with the page's context, so a POST with
  `maxRedirects: 0` leaves the session in the context and the 303 is not followed (following it would render the
  dashboard a second time).

E2E against `next dev` is unreliable: each stamp re-renders the whole dashboard, which takes 15-20 s
in dev mode with 6 parallel workers (about 1 s alone), longer than the assertions wait. The
production build answers in well under a second.

## Out of scope

A hosted test deployment (it would need a second Supabase project and a host; AC-4 would then need
an explicit allowance for that project's URL). Tests of the map canvas (WebGL clicks).

## Coverage

| AC | Test |
| --- | --- |
| AC-1 | `tests/database-rules.test.ts` (the migrations and both seeds leave 220 checkpoints, 161 places and 72 extra stamps); CI's `e2e` job starts the stack with `supabase start` and every E2E run uses it |
| AC-2 | manual (it starts a dev server): `npm run testdb:start`, `npm run dev:test`, open http://localhost:3001. Last checked: never recorded. |
| AC-3 | `e2e/auth.spec.ts` |
| AC-4 | `src/lib/test-login.test.ts`; `tests/smoke-test.test.ts` and the deploy workflow's smoke test (spec 0026 AC-8): after every deploy a POST to `/auth/test-login` on the public address must answer 404 |
| AC-5 | `e2e/auth.spec.ts` |
| AC-6 | `playwright.config.ts`, `e2e/helpers.ts` |
| AC-8 | `e2e/auth.spec.ts` ("AC-8: the helper's sign-in leaves the session cookies…", which fails if no session reaches the browser); every other E2E test signs in through the helper. Not asserted: that the landing page isn't loaded, and the "refused" error message (both read from `e2e/helpers.ts`) |
| AC-9 | `e2e/auth.spec.ts` ("AC-3, AC-5, AC-9") |
| AC-7 | `tests/test-server-env.test.ts` (the real Next env loader, with a `.env.local` that holds a bot; and that `scripts/test-env.mjs` builds its environment with `testServerEnv`) |
