# 0059: A backup before every migration

Status: Done
Specs: [0012](../specs/0012-backups.md) AC-5 (added), [0026](../specs/0026-automatic-deploy.md) AC-14 (added)

## Goal

A merge deploys by itself, and a migration runs against production data with no way back: the weekly backup can be
six days old. Take a backup of the user data right before the first missing migration is applied, and refuse to
migrate when the backup fails.

## What the owner has to do

Nothing is required. The deploy already has the repository secret `SUPABASE_DB_URL`, the same one the weekly backup
uses, and a manual run of the Backup workflow on 2026-10-04 proved that the dump works from GitHub's runners
(1 m 19 s, check step passed, artifact stored; spec 0012, Notes). Optional, see the decisions below: a passphrase
secret if the artifacts should be encrypted.

## Requirements

- Before the first missing migration is applied, the deploy backs up the user data: it dumps the same tables as the
  weekly backup with the same steps and stores the dump as the workflow artifact `pre-migration-<sha7>` for 30 days.
- A dump that fails or does not pass its check stops the deploy before any migration runs, and the failure is
  reported like any failed step (spec 0026 AC-9).
- A deploy with no missing migration takes no dump. A dry run says that a dump would be taken and takes none.
  Whether migrations are missing is decided by the migration script's own dry run (`--dry-run`), so one place knows.
- The dump is one piece used by every workflow that takes one, a composite action under `.github/actions/`, so the
  table list, the exclude list and the check step exist once. The weekly run and the pre-migration dump differ only
  in the artifact's name and retention, which they pass in. The action gets the connection string as an input from
  the caller's `env` and never prints it.

## Decisions taken (the owner may overrule)

- **Which data**: the same six tables as the weekly backup (accounts, identities, stamps, extra stamps, profiles,
  friendships). The schema and the reference data come back from git (migrations and seeds), so they are not dumped.
  To restore after a bad migration: check out the commit before the merge, apply its migrations and seeds to an
  empty database, load the dump (spec 0012, Restore).
- **Where**: a workflow artifact, 30 days. Artifacts are readable by everyone with access to the repository and hold
  emails and Google profile data. The repository is private with one owner, so the dump is not encrypted; revisit
  when either changes (encrypting needs one new secret and one `gpg` step).
- **When**: only when a migration is missing.

## Done when

- [x] The composite action (the dump and its check, moved out of `backup.yml`), used by `backup.yml` and `deploy.yml`
- [x] A step in `deploy.yml` between the plan and the migration: dry run, then the dump when something is missing; a failing dump stops the chain and reaches the failure message
- [x] `tests/backup-workflow.test.ts` and `tests/deploy-workflow.test.ts` cover the requirements (the table lists live in the action only; the dump step comes after the plan and before the migration step; it runs only when a migration is missing; a failing dump stops the chain; the artifact name and retention; the dry run takes none; the secret goes through `env`)
- [x] Struck: the first deploy that has a migration is watched once. A pull request cannot do it (only a real deploy shows it); the `manual` rows of specs 0012 (AC-5) and 0026 (AC-14) carry it, with `Last checked: never recorded` until whoever watches it writes the date
- [x] The requirements are written into specs 0012 and 0026 as ACs, with their coverage rows (spec 0034 AC-6)

## Spec changes

Spec 0012: AC-5 added (the dump, its check and the upload are one composite action, `.github/actions/dump-user-data`,
used by the weekly backup and the deploy; inputs; the connection string only in the dump step's `env`); Owner code
names the action; AC-1's wording points at it; Notes: the dump command lives in the action, restore from a
`pre-migration-<sha7>` artifact ("After a bad migration"), the dump is not encrypted and why; the coverage table has
a test row and a `manual` row (`Last checked: never recorded`) for AC-5. Spec 0026: AC-14 added (a dump before the first
missing migration, decided by the migration script's dry run, none when nothing is missing or in a dry run, a failing
dump stops the deploy and is reported); AC-9 names the backup among the failing steps; Decisions and Notes record
the choices (artifact, 30 days, unencrypted, six tables, only when a migration is missing, no overwrite and what that
means for a re-run); the coverage table has a test row and a `manual` row (`Last checked: never recorded`).
`specs/README.md` needs no change (no spec added, statuses unchanged).

## Notes

- The restore drill (spec 0012 AC-4) was done on the local stack only; loading a dump into a real Supabase project
  was never tried (whether the `postgres` role may set `session_replication_role` is not verified).
