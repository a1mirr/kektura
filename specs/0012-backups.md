# 0012: Weekly backup of production user data

Status: Accepted
Owner code: `.github/workflows/backup.yml`

## Goal

The only irreplaceable data is what users entered: their accounts and stamps. Everything else can
be rebuilt from migrations and seeds. The free Supabase plan gives no downloadable backups, so take
our own.

## Behaviour

- **AC-1**: A GitHub Actions workflow runs weekly and on manual dispatch. With the repository secret
  `SUPABASE_DB_URL` (production connection string) it dumps the data of `auth.users`,
  `auth.identities`, `public.user_stamps` and `public.user_extra_stamps` with the Supabase CLI
  (`supabase db dump --data-only`, using the CLI version pinned in `package.json`). The dump is stored
  as a workflow artifact with 90-day retention.
- **AC-2**: Without the secret, the workflow ends successfully with a notice saying what to configure;
  it never fails the repository's checks.
- **AC-3**: The secret is never printed: the workflow uses only the secret reference and no
  `set -x`.
- **AC-4**: Restore steps are documented under Notes below and tested once against the local test
  database: migrations + seeds, then the dump.

## Out of scope

Point-in-time recovery; backing up reference data (seeds) or schema (migrations).

## Notes

To be filled in by the implementation: the exact dump command, and restore steps verified on the
local stack (e.g. dump the local test DB with the same command, `npm run testdb:reset`, load the dump,
check the users' stamps are back).

The user still has to add `SUPABASE_DB_URL` (Supabase → Project Settings → Database → connection
string, session pooler) as a GitHub Actions secret. GitHub artifacts are visible to everyone with
access to the repository: keep it private.

## Coverage

| AC | Test |
| --- | --- |
| AC-1 ... AC-3 | `.github/workflows/backup.yml`; checked on the first manual run (manual) |
| AC-4 | manual: restore drill on the local stack, recorded in Notes |
