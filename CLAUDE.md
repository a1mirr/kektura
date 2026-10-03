# Kektura tracker

Tracks progress on the Országos Kéktúra (Hungary's Blue Trail): Google sign-in, mark the 161 official stamping places (plus extra stamps), see walked km, stages, a map and a route planner.

Stack: Next.js 16 (App Router, TS, Tailwind 4), next-intl (`ru` default, `en`, `hu`), Supabase (Google OAuth, Postgres + RLS), MapLibre, Recharts, Vitest + Testing Library, Playwright. Next 16 differs from older versions (`src/proxy.ts` instead of middleware, `params` are Promises): read `node_modules/next/dist/docs/` before using an unfamiliar API.

## Commands
- `npm run dev` (port 3000, production Supabase via `.env.local`); `npm run build`
- `npm test` / `npm run test:watch`; `npm run check` = typecheck + lint + tests (the Stop hook's gate)
- Test server: `npm run testdb:start` | `testdb:reset` | `testdb:stop` (local Supabase in Docker), `npm run dev:test` (port 3001, dummy login)
- `npm run e2e`: Playwright against a production build of the test server on port 3002

## Workflow
- **Spec first.** Every feature, behaviour change or non-trivial fix starts as `specs/NNNN-slug.md` (from `specs/_template.md`) with numbered acceptance criteria; settle open questions with the user before coding. Specs are always written in English. Tests cite them: `describe("spec NNNN: …")`, `it("AC-n: …")`. Changing behaviour = edit the owning spec (never renumber ACs) + its tests in the same change. Details: `specs/README.md`.
- **Logic in `src/lib`** as pure functions with unit tests; pages only fetch and render. Components get `*.test.tsx` with `// @vitest-environment jsdom`. Async Server Components can't be unit-tested: cover them with E2E.
- **Stop hook** (`.claude/hooks/stop-check.mjs`) runs typecheck + lint + unit tests before a turn ends and blocks until green; it asks once when app code changed without a spec/test change. Fix the failure, don't work around it. Run `npm run e2e` yourself before committing user-flow changes (needs Docker, so the hook doesn't).
- **Migrations go local first.** New file in `supabase/migrations` → `npm run testdb:reset` → tests + E2E → apply to production through the Supabase MCP (`apply_migration`) → `npm run types:gen` (rewrites `src/lib/supabase/database.types.ts` from the local DB; CI's `types:check` fails when it is stale) → check `get_advisors`. RLS policies use `(select auth.uid())` and `to authenticated`.
- **Changelog** (spec 0018 AC-7). A change users can see (behaviour, a rename, a page) adds or extends an entry in `src/content/changelog.ts` in the same pull request, in all three languages; process, test, refactor and deploy-file changes add none. Dates can't repeat, so a change made on the newest entry's date joins that entry.
- **Fresh-context review before merge** (spec 0022). When the change is done and committed (spec closed, `npm run check` green, E2E run for user-flow changes) and before it is merged, an agent with no context of the work reviews it: spawn the `fresh-reviewer` agent (`.claude/agents/fresh-reviewer.md`) and tell it only the spec number (`none` for a small change that has no spec) and the base branch, never your reasoning or what to look at. Fix every valid finding and answer the rest in the pull request description, with the commit that was reviewed. Fixes that change code, tests or behaviour get another fresh review (a review of an earlier state doesn't count); wording-only fixes don't, so the pull request's head is the reviewed commit plus, at most, wording fixes. Never hand a pull request over as ready to merge without it, and leave the working tree alone while the review runs (another Claude session that shares the checkout should work in its own `git worktree`). Every change a person or Claude writes is reviewed, documentation included; Dependabot's pull requests are not (CI judges them). Project agents load when a session starts, so in the session that created or edited the agent file spawn a general-purpose agent with the same brief (the file's body).
- **Branches and pull requests.** `main` is GitHub's default branch and the one that gets deployed. Work on a topic branch (`git switch -c <topic>`), push it and open a pull request; merge only when CI is green (jobs "Typecheck, lint, unit tests" and "End-to-end tests"). Never push to `main` on GitHub: a `pre-push` hook (`.githooks/`, spec 0021) refuses it. Install it once per clone with `npm run hooks:install`; pushing to the `production` remote is unaffected. There is no `gh` here: `git push -u origin <topic>` prints the link to open the pull request. After a merge: `git switch main && git pull`, then deploy if asked.

## Where the rules live
- Progress (places, walked stretches, stats, stages): `src/lib/progress.ts`, spec 0001
- Stamping (server actions, buttons): `src/app/[locale]/dashboard/actions.ts`, spec 0002
- Map and route planner: `src/components/TrailMap.tsx`, `src/lib/route-*.ts`, spec 0003
- Trail data, sources and regeneration (`scripts/build-data.mjs`; never hand-edit its outputs): spec 0004
- Auth, routing, translations: spec 0005; test server, dummy login, E2E: spec 0006
- Footer pages and the account page (sign out, delete account, the `/settings` redirect): specs 0014, 0025; About page (its text must stay true: no "open source"/"PWA" until they are): 0015; changelog (`src/content/changelog.ts`): 0018; useful links (`src/content/links.ts`): 0019
- Stamp dates (`src/lib/stamp-date.ts`, `StampDateInput`): spec 0016; feedback form + Telegram notifications: 0017; request origin behind the proxy and the `deploy/` files: 0020; pull-request-only guard: 0021; fresh-context review before merge: 0022; friends (behind `FF_FRIENDS=1`, off in production until switched on; every friendship write goes through `security definer` functions): 0024

## Gotchas
- `next.config.ts` wires next-intl by hand: `createNextIntlPlugin` loads native `@swc/core`, which fails on this Windows machine. Its `distDir` comes from `NEXT_DIST_DIR` (`.next-test` / `.next-e2e` for the test servers).
- `src/proxy.ts` matcher is a TS string: the extension escape must stay `\\.` (a single `\.` makes it match only `/`; `src/proxy.test.ts` guards this).
- Landing page and dashboard both check the session with `getUser()`; mixing in `getClaims()` can loop on a revoked but unexpired token.
- Stamp, delete-account and feedback actions never throw (they return a result; a thrown error reaches the client as an opaque message). Stamping writes with `ignoreDuplicates`; its optional `date` only dates rows that are *created*. Editing a date is a separate update-only action (`setStampDate`); never save a date on every `change` event (Chrome fires one per keystroke): see `StampDateInput`.
- Build redirect URLs in route handlers with `requestOrigin(request)` (`src/lib/origin.ts`), never from `request.url` (it says `localhost` behind Caddy) or raw forwarded headers.
- Feedback (`src/app/[locale]/(pages)/feedback/`): public, so validated, honeypotted and rate limited; the Telegram token is in the request URL, so never log URLs, fetch error objects or message text. `npm run telegram:check` verifies the setup.
- Node's `fetch` keeps sockets open and crashes a process at exit on Windows (libuv assertion): scripts throw instead of `process.exit()`, and E2E helpers use Playwright's `request`, not `fetch`.
- Full-height pages (landing, error) use `flex-1`, not `min-h-screen`: the footer must stay on the first screen.
- Sign-out and the dummy login are plain form POSTs to route handlers under `src/app/auth/` (work before hydration). The dummy login needs BOTH `TEST_LOGIN=1` and a localhost Supabase URL: keep both guards.
- Every user-visible string goes into all three `messages/*.json` (`tests/messages.test.ts` checks parity). Message keys and `Locale` are typed (`src/i18n/global.ts`): a page that reads `params.locale` must narrow it with `hasLocale(routing.locales, locale)` / `notFound()` first.
- Failed stamp actions log one `[stamp-action]` line through `src/lib/log.ts` (spec 0008): the place to hook in error monitoring; never log emails, input or Supabase `details`/`hint`.
- The root layout renders no `<html>` (locale layouts do), so `src/app/not-found.tsx` brings its own document; `src/app/[locale]/error.tsx` is the localized error boundary (Next 16 passes `retry`, not `reset`). The UI is light-only (`color-scheme: light`); don't add body colour overrides.
- `public/maplibre/` is generated by `scripts/copy-maplibre-worker.mjs` in the `pre*` npm scripts: always start Next through npm scripts, not bare `next`.
- E2E: never against `next dev` (each stamp re-renders the whole dashboard, 15-20 s under parallel tests). Each test signs in as a fresh user (`signInAsNewUser`); wait for hydration (`expandAllStages`) before clicking client-side buttons.
- Docker Desktop here can't delete its own Unix-socket files (Windows error 1920) and then crashes on start ("initializing Inference manager … dockerInference"). Workaround: quit Docker, rename `%LOCALAPPDATA%\Docker\run` (and `%LOCALAPPDATA%\docker-secrets-engine` if the error names it) aside, start again.
- Node comes from winget: in a fresh shell refresh PATH if `npm` isn't found.

## Server & Deployment
Production is a DigitalOcean droplet (`188.166.117.212`, 1 GB RAM + swap) running PM2 behind Caddy at `kektura-tracker.com`, database and sign-in on Supabase cloud. Everything about it (setup, environment variables, deploying, rolling back, logs) is in `deploy/README.md` (spec 0020); `deploy/post-receive` is the git hook (a copy lives on the server).
- Deploy: `git push production main`, only after the database migrations are applied to production (the hook never touches the database). Never push to `production` unless the user asks.
- The hook stops at the first failing step. Server-only secrets (`TELEGRAM_*`, `SITE_URL`) live in `~/kektura_app/.env.local` on the server; `TEST_LOGIN` must never be set there.
