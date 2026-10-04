# 0042: A backup before every migration

Status: Open
Specs: [0012](../specs/0012-backups.md) AC-5 (added), [0026](../specs/0026-automatic-deploy.md) AC-14 (added)

## Goal

A merge deploys by itself, and a migration runs against production data with no way back: the weekly backup can be
six days old. Take a backup of the user data right before the first missing migration is applied, and refuse to
migrate when the backup fails.

## What the owner has to do

Nothing is required. The deploy already has the repository secret `SUPABASE_DB_URL`, the same one the weekly backup
uses, and a manual run of the Backup workflow on 2026-10-04 proved that the dump works from GitHub's runners
(1 m 19 s, check step passed, artifact stored). Optional, see the decisions below: a passphrase secret if the
artifacts should be encrypted.

## Decisions taken in the spec (the owner may overrule)

- **Which data**: the same six tables as the weekly backup (accounts, identities, stamps, extra stamps, profiles,
  friendships). The schema and the reference data come back from git (migrations and seeds), so they are not dumped.
  To restore after a bad migration: check out the commit before the merge, apply its migrations and seeds to an
  empty database, load the dump (spec 0012, Restore).
- **Where**: a workflow artifact `pre-migration-<sha7>`, 30 days. Artifacts are readable by everyone with access to
  the repository and hold emails and Google profile data. The repository is private with one owner, so the dump is
  not encrypted; revisit when either changes (encrypting needs one new secret and one `gpg` step).
- **When**: only when the script's own dry run says a migration is missing; a deploy with none takes no dump.

## Done when

- [ ] `.github/actions/dump-user-data` (the dump and its check, moved out of `backup.yml`), used by `backup.yml` and `deploy.yml`
- [ ] A step in `deploy.yml` between the plan and the migration: dry run, then the dump when something is missing; a failing dump stops the chain and reaches the failure message
- [ ] `tests/backup-workflow.test.ts` and `tests/deploy-workflow.test.ts` cover AC-5 and AC-14
- [ ] The first deploy that has a migration is watched once (a `manual` row says when it was last checked)
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6)

## Spec changes

Filled in when built.

## Notes

- The restore drill (spec 0012 AC-4) was done on the local stack only; loading a dump into a real Supabase project
  was never tried (whether the `postgres` role may set `session_replication_role` is not verified).
