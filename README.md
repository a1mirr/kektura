# Kektura tracker

Progress tracker for the Országos Kéktúra, Hungary's Blue Trail: sign in with Google, mark the 161 official stamping
places (plus extra stamps), and see the walked kilometres, the stages, a map and a route planner. It runs at
<https://kektura-tracker.com> in Hungarian, English, German and Russian. Independent project, not affiliated with MTSZ.

Built with Next.js (App Router, TypeScript, Tailwind), next-intl, Supabase (Google sign-in, Postgres with row level
security), MapLibre and Recharts, tested with Vitest and Playwright.

The code is under the [MIT licence](LICENSE); the trail and restaurant data it ships with belong to their owners
([NOTICE.md](NOTICE.md)). Contributing: [CONTRIBUTING.md](CONTRIBUTING.md). Security problems: [SECURITY.md](SECURITY.md).

## Setup
1. Create a project at https://supabase.com.
2. In the SQL editor run every file in `supabase/migrations/` in numeric order, then `supabase/seed.sql` and `supabase/seed_extra.sql` (re-run the seeds whenever they are regenerated).
3. Google login:
   - Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web).
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
   - Supabase → Authentication → Providers → Google: paste the client ID and secret.
   - Supabase → Authentication → URL Configuration: add `http://localhost:3000/**` to Redirect URLs (and your production URL with `/**` later). The wildcard matters: the app redirects to `/auth/callback?locale=<locale>`, query string included.
4. Copy `.env.example` to `.env.local` and fill in the project URL and anon key (Supabase → Project Settings → API).
5. `npm run dev` and open http://localhost:3000.

## Development
Specs describe how each area behaves now, as numbered acceptance criteria in `specs/` (see
[`specs/README.md`](specs/README.md)), and tests cite those criteria; the work on them is in GitHub issues labelled `task`. A behaviour change starts as a task, and its spec is edited as the behaviour is built, so that it is true afterwards.

- `npm test`: unit and regression tests (Vitest); `npm run test:watch` while working.
- `npm run check`: typecheck + lint + tests. Claude Code runs the same gate automatically before
  finishing a turn (`.claude/settings.json`). GitHub Actions run the same checks plus the E2E tests
  once per change, on every pull request update and every push to `main`, the E2E tests not for a pull request that
  changes only Markdown (`.github/workflows/ci.yml`, spec 0007).
- `npm run types:gen`: regenerates `src/lib/supabase/database.types.ts` from the local test database
  after a migration change (`npm run types:check` fails in CI when the file is stale).
- A weekly workflow (`.github/workflows/backup.yml`, spec 0012) dumps users and their stamps from
  production into a workflow artifact, encrypted to the maintainer's public certificate because the artifacts of a
  public repository are downloadable by everyone (the dump is `.github/actions/dump-user-data`, which the deploy also
  uses to back up the same data right before it applies a migration); it needs the `SUPABASE_DB_URL` and
  `BACKUP_PUBLIC_KEY` repository secrets.
- `.github/workflows/deploy.yml` (spec 0026) applies the missing migrations, deploys and smoke-tests production
  after a merge to `main` whose CI passed; it needs the `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` and `SUPABASE_DB_URL`
  repository secrets (setup in `deploy/README.md`, done on 2026-10-03) and does nothing without them.

## Test server
A second environment with its own local database and a dummy login (no Google account needed).
Needs Docker Desktop.

1. `npm run testdb:start`: local Supabase with all migrations and both seeds (first run downloads
   the images). Studio for browsing the test data: http://127.0.0.1:54323.
2. `npm run dev:test`, then open http://localhost:3001 and use "Sign in as test user" with any email.
   The account is created on first sign-in; a banner marks every page as the test server.
3. `npm run e2e`: the Playwright end-to-end tests. They build and start a production build of the
   test server on its own port 3002 (`npm run build:e2e` + `npm run start:e2e`), separate from
   `dev:test`.

`npm run testdb:reset` rebuilds the test database from scratch; `npm run testdb:stop` stops it.

The pictures of the landing page (`public/screenshots/`, spec 0038) are retaken by `npm run screenshots` against a running
test server (`npm run testdb:start`, then `npm run build:e2e && npm run start:e2e`, port 3002); look at them before you commit them.

Production (`npm run dev`, the cloud project) is unaffected and has no dummy login.
