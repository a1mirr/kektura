# 0012: Weekly backup of production user data

Status: Done
Owner code: `.github/workflows/backup.yml`

## Goal

The only irreplaceable data is what users entered: their accounts and stamps. Everything else can
be rebuilt from migrations and seeds. The free Supabase plan gives no downloadable backups, so take
our own.

## Behaviour

- **AC-1**: A GitHub Actions workflow runs weekly and on manual dispatch. With the repository secret
  `SUPABASE_DB_URL` (production connection string) it dumps the data of `auth.users`,
  `auth.identities`, `public.user_stamps`, `public.user_extra_stamps`, `public.profiles` and `public.friendships`
  (everything users entered or connected) with the Supabase CLI
  (`supabase db dump --data-only`, using the CLI version pinned in `package.json`). The CLI can only
  select schemas, not tables, so the workflow dumps `auth` and `public` minus an explicit exclude list
  (every other table), and a check step fails the run, deleting the dump, if any table other than the
  six shows up in it. Every table the migrations create in `public` is either one of the six or on the exclude
  list (reference data, the deploy record, `user_feedback`, whose messages also reach the developer's Telegram). The dump is stored as a workflow artifact with 90-day retention.
- **AC-2**: Without the secret, the workflow ends successfully with a notice saying what to configure;
  it never fails the repository's checks.
- **AC-3**: The secret is never printed: the workflow uses only the secret reference and no
  `set -x`.
- **AC-4**: Restore steps are documented under Notes below and tested once against the local test
  database: migrations + seeds, then the dump.

## Out of scope

Point-in-time recovery; backing up reference data (seeds) or schema (migrations).

## Notes

**Setup.** The user still has to add `SUPABASE_DB_URL` (Supabase → Project Settings → Database →
connection string, session pooler, port 5432: the direct host is IPv6-only and GitHub's runners have
no IPv6; the transaction pooler can't run `pg_dump`) as a GitHub Actions secret. The CLI wants the URL
percent-encoded, so encode special characters in the password. GitHub artifacts are visible to
everyone with access to the repository: keep it private. The dump holds the users' Google profile
data (`raw_user_meta_data`, email) and, for password users, password hashes.

**The dump.** `.github/workflows/backup.yml` runs

```
npx supabase db dump --db-url "$SUPABASE_DB_URL" --data-only --schema auth,public \
  -x auth.audit_log_entries -x auth.sessions -x auth.refresh_tokens ... -x public.checkpoints \
  --file backup/user-data-<date>.sql
```

(the full list is every other table of `auth` and `public`; the CLI doesn't expand wildcards in `-x`).
The CLI emits plain `INSERT` statements, preceded by `SET session_replication_role = replica`
(triggers and FK checks off while loading) and followed by `RESET ALL`, plus `setval` calls for the
sequences. If Supabase adds an `auth` table that holds data, the "Check the dump" step fails and
names it: add it to the exclude list. `public.applied_migrations` (the deploy workflow's record of applied
migrations, spec 0026) is there from the start: it is not user data. A new table of the app
must be put on one of the two lists (a test fails until it is). The job's secret handling: the secret is only passed through
`env:` (GitHub masks it in logs) and never echoed; there is no `set -x`.

**Restore** (verified on the local stack, see the drill below). Restore into a database that has the
schema and reference data but no users: migrations and seeds applied, `auth.users` and the stamp
tables empty (loading into populated tables fails on duplicate keys).

1. Fresh target: locally `npm run testdb:reset`; for a new Supabase project run the migrations and
   both seeds as in the README's Setup.
2. Download the artifact (GitHub → Actions → the Backup run → `user-data-backup`), unzip it to get
   `user-data-<date>.sql`.
3. Load it as the `postgres` user, stopping at the first error:
   - local, from Git Bash: `docker exec -i supabase_db_kektura psql -U postgres -d postgres -v ON_ERROR_STOP=1 < user-data-<date>.sql`
     (PowerShell has no `<`: use `cmd /c "docker exec -i ... < user-data-<date>.sql"`);
   - Supabase project: `psql "<session pooler connection string>" -v ON_ERROR_STOP=1 -f user-data-<date>.sql`.
4. Check: row counts of `auth.users`, `auth.identities`, `public.user_stamps`,
   `public.user_extra_stamps`, `public.profiles` and `public.friendships` match the numbers you expect, and a user signs in and sees their stamps.

**Restore drill** (AC-4), last done on 2026-10-04 on the local test stack (E2E test users and their data), with the
very `run:` scripts of the "Dump user data" and "Check the dump" steps (extracted from the YAML) pointed at the local
database (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`): dump, `npm run testdb:reset`, restore with
`ON_ERROR_STOP=1` (exit 0), compare. An md5 over every row (`string_agg(row::text, '|' order by row::text)`) was
identical before and after for all six tables:

| Table | Rows before the dump | Rows after `npm run testdb:reset` | Rows after the restore |
| --- | --- | --- | --- |
| `auth.users` | 1024 | 0 | 1024 |
| `auth.identities` | 1024 | 0 | 1024 |
| `public.user_stamps` | 709 | 0 | 709 |
| `public.user_extra_stamps` | 20 | 0 | 20 |
| `public.profiles` | 1024 | 0 | 1024 |
| `public.friendships` | 244 | 0 | 244 |

The dump contained exactly those six tables. Earlier drills (four tables) also showed stamp notes with quotes, a
backslash, a newline and non-ASCII characters surviving, and a restored password user signing in and seeing their
stamps through PostgREST with RLS. Repeat the drill after any change to the dump steps or to the tables.

**Verified on GitHub** on 2026-10-04: a manual run of the workflow against production succeeded in 1 m 19 s
(the runner's Docker pulled the CLI's `pg_dump` image, the session pooler connection worked, the check step
accepted the table list and the artifact `user-data-backup` was stored). **Not verified**: that production's
`postgres` role may set `session_replication_role` when the dump is loaded (if not, delete that first line from
the file; `pg_dump` already orders the tables so that foreign keys hold, but this is untested), and that the
no-secret path ends green with the notice (it can't be run without removing the secret).

## Coverage

| AC | Test |
| --- | --- |
| AC-1 ... AC-3 | `tests/backup-workflow.test.ts` (schedule and dispatch, the dump command and its exclude list, the check step, retention, the no-secret path, the secret handling, and that every table the migrations create is dumped or excluded). That the real run works against production is not asserted: see "Not verified" in Notes |
| AC-4 | manual (it restores into a database): the restore drill in Notes. Last checked: 2026-10-04. |
