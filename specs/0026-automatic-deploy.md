# 0026: Automatic migrations and deploy after a merge

Status: Done
Owner code: `.github/workflows/deploy.yml`, `scripts/migrate-production.mjs`, `scripts/smoke-test.mjs`,
`scripts/notify-telegram.mjs`, `scripts/deploy-plan.mjs`, `scripts/lib/deploy.mjs`, `deploy/ssh-gate.sh`, `deploy/README.md`

## Goal

After a merge to `main` with green CI, production updates itself: migrations first, then the code, then a check
that the site answers, and a failure stops the chain and says so. The manual sequence (apply the new migrations,
check the generated types and the advisors, then `git push production main`, `CLAUDE.md`, spec 0020) stays as the
fallback for a rollback or a broken workflow: done by hand it is easy to get in the wrong order or to forget, and a
merged pull request that sits undeployed is invisible.

## Decisions

Made by the owner on 2026-10-03:

- **No approval gate.** A green merge goes live by itself, migrations included. (A gate for pull requests that
  add a migration was the recommendation; the owner chose fully automatic.) What a gate would have caught is
  left to the review: AC-5.
- **Docs-only merges are skipped** (AC-12).
- **The owner adds the secrets** (below). Until they exist the workflow ends with a notice instead of failing,
  like `backup.yml`, so this can be merged first.

Taken from the earlier recommendations, because nothing against them was said (change them by editing this
spec, then the code):

- **Migrations are tracked by a small script and its own table**, `public.applied_migrations (file_name)`, not
  by the Supabase CLI's history: production's history holds the versions the MCP wrote (`20261003…_friends`),
  not the file names in the repository, so `db push` would try to run every file again.
- **Database connection**: the `SUPABASE_DB_URL` secret that `backup.yml` already uses (session pooler,
  `postgres` role, so DDL works). The migration script runs `psql`, which the runners have.
- **Server access**: a deploy key whose `authorized_keys` entry forces `deploy/ssh-gate.sh`, so it can only
  reach `~/kektura.git`.
- **Failure messages**: the Telegram bot of spec 0017, through the repository secrets `TELEGRAM_BOT_TOKEN` and
  `TELEGRAM_CHAT_ID` when they are set; otherwise only GitHub's own failure e-mail.

Also on 2026-10-03: the owner gave the author a standing permission to merge the author's own pull requests once CI
is green and the fresh review is done (`CLAUDE.md`, spec 0021 AC-6). With no approval gate, such a merge is a deploy.

Secrets (repository secrets, used by `deploy.yml` only): `DEPLOY_SSH_KEY` (private key), `DEPLOY_KNOWN_HOSTS`
(the droplet's host key line, from `ssh-keyscan`), `SUPABASE_DB_URL` (exists), `TELEGRAM_BOT_TOKEN` and
`TELEGRAM_CHAT_ID` (optional).

## Behaviour

### When it runs

- **AC-1**: A deploy starts only for a push to `main` (a merged pull request) whose CI jobs ("Typecheck, lint,
  unit tests" and "End-to-end tests") passed on that commit: the deploy workflow is started by the completion
  of the CI workflow and checks that it succeeded, was a push and was on `main`. Pull requests, other branches
  and forks never reach the deploy job or its secrets. A failed or still running CI never deploys.
- **AC-2**: Only one deploy runs at a time. A merge that arrives while one is running waits for it and then
  deploys the newest `main` (the older one is skipped, not run in parallel). The deploy job has the concurrency
  group, not the workflow, so a run whose job is skipped (CI failed on `main`, say) never takes the place of a
  deploy that is waiting, and a dry run has a group of its own. What a run deploys is not the commit whose CI
  started it but the newest commit of `main` whose CI passed, so it does not matter which waiting run survives
  or in which order the CI runs of two merges finish.
- **AC-3**: A deploy can also be started by hand from the Actions tab (`workflow_dispatch`), only from `main`
  (another branch never reaches the secrets), for the current `main`, with an option `dry_run` (on by default)
  that lists the migrations that would be applied and the commit that would be deployed, and changes nothing.
  A run that does change something needs a passed CI run on that commit, like a merge does (AC-1).

### Migrations

- **AC-4**: Migrations are applied to production before the code is deployed, in file name order, each one in
  its own transaction, and an applied migration is recorded by its file name, in the same transaction, so it is
  never applied twice. A migration that fails stops the deploy: the code is not deployed and the failure is
  reported (AC-9).
- **AC-5**: A migration must be compatible with the code that runs in production while it is applied (the
  previous commit): while the deploy runs, old code meets the new schema. Dropping or renaming something the
  running code uses is done in two merges, the second after the first has been deployed. The review of a
  migration checks this (`specs/README.md`), the workflow cannot.
- **AC-6**: Migrations are named after the task that adds them (`CLAUDE.md`, spec 0034 AC-5), so a new file can sort before one
  that is already applied (`0023_…` merged after `0024_…`). It is applied anyway, in order of its name among
  the ones that are still missing; a file that is already recorded is never applied again, and the content of
  an applied file is not compared or re-run.
- **AC-13**: The migration script never guesses what production has. With no record table, or an empty one, it
  refuses to run unless it is given `--baseline <file>` (the `baseline` input of a manual run), which records
  that file and every file that sorts before it as applied, without running them: the owner checks first that
  production has them. `--baseline` on a table that already has records is refused. Secrets, and the database
  password in particular, never appear in its output.

### The code

- **AC-7**: The code is deployed by pushing `main` to the existing `production` remote, so the server still
  builds it itself with `deploy/post-receive` (spec 0020: install, build, then reload; a failed build never
  reloads). The push is a fast-forward, never forced, and it counts only when the server's hook reports
  `Deployed <sha>`: `git push` exits 0 even when the hook fails, so the workflow reads the hook's last line and
  fails without it. The workflow authenticates with a key whose forced
  command (`deploy/ssh-gate.sh`) lets it reach only that repository (push and list refs).
- **AC-8**: After the reload the workflow requests `/en` and `/ru` on the public address and expects 200, expects
  an unknown route to answer 404, and POSTs to `/auth/test-login`, expecting 404 too: the test server's dummy login
  signs anybody in and must never be reachable on the public address (spec 0006 AC-4). It is a sanity check of the
  running build, not a test suite; a route behind a feature flag would fail every deploy once the flag is
  switched on. It retries for up to two minutes,
  because the reload takes a moment.

### What is deployed

- **AC-12**: A merge whose changes, compared with the commit production already runs, touch only
  documentation, specs, tests and repository tooling (both sides of a rename count) (`specs/`, `tests/`, `e2e/`, `.github/`, `.claude/`,
  `.githooks/` and `*.md`) is not deployed and applies no migration; the run says why. Anything else deploys,
  `supabase/`, `deploy/` and `package.json` included. A commit that production already contains, or that is
  older than what it runs, is skipped as well, so a run that finishes late never puts older code over newer.

### Failure and visibility

- **AC-9**: A failed step (migration, push, smoke test) fails the workflow, stops the later steps and sends
  one message to the developer through the Telegram bot that spec 0017 already uses (the commit, the failed
  step, a link to the run), when the bot is configured. The job summary lists what was applied and deployed.
  Nothing rolls back by itself: the summary says how (revert the pull request and merge it, spec 0020's
  README), and what state the database is in.
- **AC-10**: The secrets (the production database connection, the deploy key, the Telegram bot) are repository
  secrets used by this workflow only, never printed, and the workflow's permissions are read-only (the repository
  contents, and the list of CI runs to see whether CI passed on a commit deployed by hand).
- **AC-11**: The manual procedure stays documented in `deploy/README.md` as the fallback, and `CLAUDE.md` is
  updated: a merge deploys, so "never push to `production` unless asked" becomes "the workflow deploys; a
  manual push is only for a rollback or when the workflow is broken".

## Out of scope

A staging environment; preview deployments of pull requests; blue-green or zero-downtime deploys (spec 0020
leaves that to be tried on the server first); automatic rollback of a deployed build or a migration; running
the Supabase advisors (they exist only in the Supabase MCP, so they stay a manual look after a schema change);
turning feature flags on (a flag is switched by hand on the server, spec 0024 AC-15); applying regenerated trail
seeds (spec 0004) and clearing the dashboard cache afterwards, which stay manual (`deploy/README.md`).

## Notes

- The current manual sequence, now automated: `apply_migration` for each new file, `npm run types:gen` and
  `npm run types:check` (CI already fails when the generated types are stale), `get_advisors`, then
  `git push production main`. A schema change goes first because the running code must never meet a schema
  older than it expects; AC-5 is the other half of that. The advisors stay a manual look after a schema change.
- The hook on the server is not changed: it already stops at the first failing step and only deploys `main`
  (spec 0020 AC-5). The workflow only replaces the human who pushes.
- The pre-push guard of spec 0021 refuses a push to `main` on GitHub from a clone; it does not concern the
  `production` remote and is not involved here.
- `NEXT_PUBLIC_*` values are compiled into the build the server makes from its own `.env.local`; nothing the
  workflow knows reaches the build.
- Migration file names are the record of what is applied, so a file must never be renamed after it was
  merged.
- **Setup**: the deploy key is installed on the droplet behind `deploy/ssh-gate.sh`, and the secrets `DEPLOY_SSH_KEY`,
  `DEPLOY_KNOWN_HOSTS` and `SUPABASE_DB_URL` are set. The first run started by hand (`dry_run` off, `baseline`
  `0024_friends.sql`) recorded the 9 files then in the repository as applied; since then runs started by a merge have
  deployed by themselves (the first: run 37158189942).
- "What production runs" is where its `main` points. After a push whose build failed on the server that is the
  commit that failed, so re-running the workflow skips it: merge a fix, or rebuild on the server by hand (the
  hook, `deploy/README.md`). The workflow fails in that case (AC-7); it does not retry by itself.
- A manual deploy (the fallback: migrations through the MCP, then a push by hand) must record each
  applied file in `public.applied_migrations`, or the next automatic run applies it again (`deploy/README.md`).
- The migration step has no `lock_timeout`: a migration that queues behind a long transaction holds the job until the
  step's timeout (10 minutes). Passing one through `PGOPTIONS` was left out because the pooler may not accept
  startup options; try it on the first real migration if it ever matters.
- The first run needs the baseline (AC-13): production has every file in `supabase/migrations/` today, so the
  baseline is the newest file name, `0024_friends.sql`. The setup steps are in `deploy/README.md`.
- The deploy workflow is started by the end of CI (`workflow_run`), not by the push itself, because that is
  the only way to start after both CI jobs have passed on that very commit. Such a workflow runs with the
  secrets of the default branch, which is why it checks out only a commit of `main` and never runs for a pull
  request (AC-1).

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2, AC-3, AC-10 | `tests/deploy-workflow.test.ts` (the trigger and its conditions, the commit picked (the newest whose CI passed), a run started from the Actions tab only from `main` and only for a commit CI passed, the concurrency group on the job and a separate one for dry runs, a timeout on the push step, the `dry_run` input, read-only permissions, secrets only in `env`, none echoed) |
| AC-4, AC-6, AC-13 | `tests/migrate-production.test.ts` (order, recorded in the same transaction, skipped when recorded, a file that sorts before the latest applied one, stop at the first failure, the baseline rules, the password redacted) |
| AC-4, AC-13 (against a real database) | manual (it runs the script against a database through `docker exec psql`): the real `migrate()` against the local test database: refused without a baseline, a baseline recorded without running its files, a failing file rolled back with nothing recorded and the later file not tried, the record table with row level security and no grants for the API roles, a second run applying nothing, a baseline on a table with records refused. Repeat after any change to the SQL in `scripts/migrate-production.mjs`. Last checked: 2026-10-03. |
| AC-5 | `tests/review-process.test.ts` (the reviewer's brief, spec 0022 and `CLAUDE.md` ask for it); manual (judgement): the reviewer checks every migration against it. Last checked: every pull request. |
| AC-7 | `tests/deploy.test.ts` (the hook, spec 0020), `tests/deploy-workflow.test.ts` (pushes only to `production`, never forced; fails unless the hook's `Deployed <sha>` line comes back, and the hook prints exactly that; the gate script allows only that repository: run for real on Linux) |
| AC-8 | `tests/smoke-test.test.ts` (the checks, including that the dummy login answers 404, and the retry, against a local server); the first deploy a merge started by itself (run 37158189942, 2026-10-03) passed the first three checks against production |
| AC-8 (the dummy login on production) | manual (it needs a real deploy): the "Check that the site answers" step of a deploy after this check was added says the smoke test passed. Last checked: 2026-10-04 (run 37163363692: the smoke test passed on its second attempt, the first got a 502 while the server reloaded). |
| AC-9 | `tests/deploy-workflow.test.ts` (failure notification step, job summary), `tests/notify-telegram.test.ts` (the message, no token in the output, against a fake API); manual (it needs a real failing run): break a step on purpose once on a throwaway commit and see the Telegram message. Last checked: never recorded. |
| AC-11 | `tests/deploy-workflow.test.ts` (`CLAUDE.md` and `deploy/README.md` describe the workflow and the fallback) |
| AC-12 | `tests/deploy-plan.test.ts` (which paths deploy, older and already deployed commits) |
