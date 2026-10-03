# 0026: Automatic migrations and deploy after a merge

Status: Draft
Owner code: `.github/workflows/deploy.yml`, `scripts/migrate-production.mjs`, `scripts/smoke-test.mjs`, `deploy/README.md`

## Goal

Today a merged change reaches production only when someone runs the same manual sequence by hand: apply the new
migrations through the Supabase MCP, check the generated types and the advisors, then `git push production main`
(`CLAUDE.md`, spec 0020). It is easy to do in the wrong order or to forget, and a merged pull request that sits
undeployed is invisible. After a merge to `main` with green CI, production should update itself: migrations
first, then the code, then a check that the site answers, and a failure must stop the chain and say so.

## Behaviour

### When it runs

- **AC-1**: A deploy starts only for a push to `main` (a merged pull request) whose CI jobs ("Typecheck, lint,
  unit tests" and "End-to-end tests") passed on that commit. Pull requests, other branches and forks never
  reach the deploy job or its secrets. A failed or still running CI never deploys.
- **AC-2**: Only one deploy runs at a time. A merge that arrives while one is running waits for it and then
  deploys the newest `main` (the older one is skipped, not run in parallel).
- **AC-3**: A deploy can also be started by hand from the Actions tab (`workflow_dispatch`) for the current
  `main`, with an option `dry_run` that lists the migrations that would be applied and the commit that would
  be deployed, and changes nothing.

### Migrations

- **AC-4**: Migrations are applied to production before the code is deployed, in file name order, each one in
  its own transaction, and an applied migration is recorded by its file name so it is never applied twice. A
  migration that fails stops the deploy: the code is not deployed and the failure is reported (AC-9).
- **AC-5**: A migration must be compatible with the code that runs in production while it is applied (the
  previous commit): while the deploy runs, old code meets the new schema. Dropping or renaming something the
  running code uses is done in two merges, the second after the first has been deployed. The review of a
  migration checks this (`specs/README.md`), the workflow cannot.
- **AC-6**: Migrations are named after the spec that owns them (`CLAUDE.md`), so a new file can sort before one
  that is already applied (`0023_…` merged after `0024_…`). It is applied anyway, in order of its name among
  the ones that are still missing; a file that is already recorded is never applied again, and the content of
  an applied file is not compared or re-run.

### The code

- **AC-7**: The code is deployed by pushing `main` to the existing `production` remote, so the server still
  builds it itself with `deploy/post-receive` (spec 0020: install, build, then reload; a failed build never
  reloads). The workflow authenticates with a key that can only push to that repository.
- **AC-8**: After the reload the workflow requests `/en` and `/ru` on the public address and expects 200, and
  expects a route that must be 404 while its feature flag is off to answer 404 (a sanity check of the
  running build, not a test suite). It retries for up to two minutes, because the reload takes a moment.

### Failure and visibility

- **AC-9**: A failed step (migration, push, smoke test) fails the workflow, stops the later steps and sends
  one message to the developer through the Telegram bot that spec 0017 already uses (the commit, the failed
  step, a link to the run), when the bot is configured. The job summary lists what was applied and deployed.
  Nothing rolls back by itself: the summary says how (revert the pull request and merge it, spec 0020's
  README), and what state the database is in.
- **AC-10**: The secrets (the production database connection, the deploy key, the Telegram bot) are repository
  secrets used by this workflow only, never printed, and the workflow's permissions are read-only for the
  repository contents.
- **AC-11**: The manual procedure stays documented in `deploy/README.md` as the fallback, and `CLAUDE.md` is
  updated: a merge deploys, so "never push to `production` unless asked" becomes "the workflow deploys; a
  manual push is only for a rollback or when the workflow is broken".

## Out of scope

A staging environment; preview deployments of pull requests; blue-green or zero-downtime deploys (spec 0020
leaves that to be tried on the server first); automatic rollback of a deployed build or a migration; running
the Supabase advisors (they exist only in the Supabase MCP, so they stay a manual look after a schema change);
turning feature flags on (a flag is switched by hand on the server, spec 0023 and 0024).

## Open questions

- **Approval gate.** Fully automatic (a green merge goes live) or one click in between, with a GitHub
  Environment `production` that requires the owner's approval before the deploy job starts? The gate costs a
  click per merge and protects against a bad migration; recommended at first for any pull request that adds a
  file in `supabase/migrations/`, automatic for the rest. Which one?
- **How migrations are tracked.** Production's history holds the versions the MCP wrote (timestamps and bare
  names, `20261003…_friends`), not the file names in the repository (`0024_friends.sql`), so the Supabase CLI's
  `db push` would not recognise any of them and would try to run them all again. Options: (a) a small script
  (`scripts/migrate-production.mjs`) with its own table `public.applied_migrations (file_name)`, seeded once with
  the files already applied (recommended: it matches AC-6 and the naming rule); (b) repair the CLI's history
  once by hand (`supabase migration repair`) and use `db push --include-all`. (b) keeps the standard tool, but
  every file would have to follow its timestamp convention, which the spec-number naming does not.
- **Database access from GitHub.** The backup workflow already uses a `SUPABASE_DB_URL` secret (the session
  pooler). Is a connection with that user acceptable for migrations (they need DDL rights, so it is the
  `postgres` role), or should a separate, narrower role exist? Is the project's network restriction open to
  GitHub's runners?
- **Server access from GitHub.** A deploy key on the droplet limited to `git-receive-pack` of `~/kektura.git`
  (a `command=` restriction in `authorized_keys`), added as a secret. Is the droplet's SSH port reachable from
  GitHub's runners, or must the workflow go through something else?
- **Docs-only merges.** Skip the deploy when a merge changes only `specs/`, `*.md` and tests (a build and a
  reload of a 1 GB droplet for nothing), or always deploy for simplicity?
- **Telegram on failure.** Reuse the feedback bot and chat (spec 0017), or only rely on GitHub's own failure
  e-mail?

## Notes

- The current manual sequence, to be automated: `apply_migration` for each new file, `npm run types:gen` and
  `npm run types:check` (CI already fails when the generated types are stale), `get_advisors`, then
  `git push production main`. A schema change goes first because the running code must never meet a schema
  older than it expects; AC-5 is the other half of that.
- The hook on the server is not changed: it already stops at the first failing step and only deploys `main`
  (spec 0020 AC-5). The workflow only replaces the human who pushes.
- The pre-push guard of spec 0021 refuses a push to `main` on GitHub from a clone; it does not concern the
  `production` remote and is not involved here.
- `NEXT_PUBLIC_*` values are compiled into the build the server makes from its own `.env.local`; nothing the
  workflow knows reaches the build.
- Migration file names are the record of what is applied, so a file must never be renamed after it was
  merged (the one rename done before the first deploy of `0024_friends.sql` was possible only because nothing
  had been applied yet).

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2, AC-3, AC-10 | planned: `tests/deploy-workflow.test.ts` (the trigger, the CI gate, the concurrency group, the `dry_run` input, read-only permissions, no secret echoed) |
| AC-4, AC-6 | planned: `scripts/migrate-production.test.ts` (order, recorded by file name, skipped when recorded, a file that sorts before the latest applied one, stop at the first failure) |
| AC-5 | manual: reviewed with every migration (the fresh reviewer checks it, spec 0022) |
| AC-7 | `tests/deploy.test.ts` (the hook, spec 0020); planned: `tests/deploy-workflow.test.ts` (pushes only to `production`) |
| AC-8 | planned: `scripts/smoke-test.test.ts` (the checks and the retry, against a local server) |
| AC-9 | planned: `tests/deploy-workflow.test.ts` (failure notification step, job summary); manual: break a step on purpose once with `dry_run` off on a throwaway commit |
| AC-11 | review of `deploy/README.md` and `CLAUDE.md` |
