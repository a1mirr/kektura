# 0012: Weekly backup of production user data

Status: Done
Owner code: `.github/workflows/backup.yml`, `.github/actions/dump-user-data/action.yml`

## Goal

The only irreplaceable data is what users entered: their accounts and stamps. Everything else can
be rebuilt from migrations and seeds. The free Supabase plan gives no downloadable backups, so take
our own: every week, and once more before a deploy applies a migration (AC-5). The artifacts of a public repository are open to
every GitHub user, so a dump is only ever stored encrypted (AC-6).

## Behaviour

- **AC-1**: A GitHub Actions workflow runs weekly and on manual dispatch. With the repository secret
  `SUPABASE_DB_URL` (production connection string) it dumps the data of `auth.users`,
  `auth.identities`, `public.user_stamps`, `public.user_extra_stamps`, `public.profiles` and `public.friendships`
  (everything users entered or connected) with the Supabase CLI
  (`supabase db dump --data-only`, using the CLI version pinned in `package.json`). The CLI can only
  select schemas, not tables, so the workflow dumps `auth` and `public` minus an explicit exclude list
  (every other table), and a check step fails the run, deleting the dump, if any table other than the
  six shows up in it (the dump, the exclude list and the check are the action of AC-5). Every table the migrations create in `public` is either one of the six or on the exclude
  list (reference data, the deploy record, the feature flag tables, which migrations seed and the developer sets, `user_feedback`, whose messages also reach the developer's Telegram). The dump is stored, encrypted (AC-6), as a workflow artifact with 90-day retention.
- **AC-2**: Without the secrets `SUPABASE_DB_URL` and `BACKUP_PUBLIC_KEY` (AC-6), the workflow ends successfully with a
  notice saying what to configure; it never fails the repository's checks.
- **AC-3**: The secret is never printed: the workflow uses only the secret reference and no
  `set -x`.
- **AC-4**: Restore steps are documented under Notes below and tested once against the local test
  database: migrations + seeds, then the dump.
- **AC-5**: The dump, its check and the upload of the artifact are one composite action under `.github/actions/`
  (`dump-user-data`), used by every workflow that takes a dump: the weekly backup (artifact `user-data-backup`, 90 days)
  and the deploy, which takes one right before the first missing migration (artifact `pre-migration-<sha7>`, 30 days,
  spec 0026 AC-14). The table list, the exclude list and the check step exist only in the action; the two callers
  differ only in the artifact's name and retention, which they pass in. The action gets the connection string and the
  certificate of AC-6 as inputs, which the caller takes from its own `env` (where the secrets are); it reads the string
  only in the dump step's `env` and the certificate only in the encryption step's, and never prints them.
- **AC-6**: The artifact never holds the dump in plain text: the artifacts of a public repository can be downloaded by
  every GitHub user, and the dump holds emails and Google profile data. After the check, the action encrypts every dump
  file to the owner's public X.509 certificate (the repository secret `BACKUP_PUBLIC_KEY`, passed in by the caller;
  `openssl cms -encrypt`, AES-256), deletes the plaintext and uploads only the folder of `.sql.cms` files. Only the
  owner's private key, which is never in GitHub, opens them. A malformed certificate (a private key instead
  of a certificate, say) or an empty one fails the step with a message, so nothing is uploaded. The weekly workflow
  skips itself with the notice of AC-2 when the secret is not set at all, and fails at the encryption step when it is
  set to something that is not a certificate; a deploy that has a migration to apply stops at its backup step, before
  the migration (spec 0026 AC-14), while one without a migration needs no certificate.

## Out of scope

Point-in-time recovery; backing up reference data (seeds) or schema (migrations).

## Notes

**Setup.** The owner has to add two repository secrets. `SUPABASE_DB_URL` (Supabase → Project Settings → Database →
connection string, session pooler, port 5432: the direct host is IPv6-only and GitHub's runners have
no IPv6; the transaction pooler can't run `pg_dump`) as a GitHub Actions secret. The CLI wants the URL
percent-encoded, so encode special characters in the password. `BACKUP_PUBLIC_KEY` is the public half of a key pair
only the owner holds (AC-6): create it once on your own computer, keep `backup-private.pem` in a password manager or on
paper (without it the backups cannot be opened, and it must never be in the repository or in GitHub) and store the contents of
`backup-cert.pem` as the secret:

```
openssl req -x509 -newkey rsa:4096 -nodes -keyout backup-private.pem -out backup-cert.pem -days 36500 -subj "/CN=kektura-backup"
```

(In Git Bash on Windows write `-subj "//CN=kektura-backup"`: MSYS would otherwise turn the subject into a path.)

The dump holds the users' Google profile data (`raw_user_meta_data`, email) and, for password users, password hashes.

**The dump.** `.github/actions/dump-user-data/action.yml` (called by `backup.yml`) runs

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
2. Download the artifact (GitHub → Actions → the Backup run → `user-data-backup`, or, after a bad migration, the
   Deploy run's `pre-migration-<sha7>`), unzip it to get `user-data-<date>.sql.cms`, and decrypt it with the private key
   (`-binary` matters: without it the line ends change):
   `openssl cms -decrypt -binary -inform DER -in user-data-<date>.sql.cms -inkey backup-private.pem -out user-data-<date>.sql`.
3. Load it as the `postgres` user, stopping at the first error:
   - local, from Git Bash: `docker exec -i supabase_db_kektura psql -U postgres -d postgres -v ON_ERROR_STOP=1 < user-data-<date>.sql`
     (PowerShell has no `<`: use `cmd /c "docker exec -i ... < user-data-<date>.sql"`);
   - Supabase project: `psql "<session pooler connection string>" -v ON_ERROR_STOP=1 -f user-data-<date>.sql`.
4. Check: row counts of `auth.users`, `auth.identities`, `public.user_stamps`,
   `public.user_extra_stamps`, `public.profiles` and `public.friendships` match the numbers you expect, and a user signs in and sees their stamps.

**After a bad migration.** The dump of a Deploy run (`pre-migration-<sha7>`, kept 30 days, taken just before the
first missing migration was applied) holds the user data as it was. The schema and the reference data come back from
git: check out the commit before the merge, apply its migrations and seeds to an empty database, then load the dump
as above (decrypting it first, step 2). The dump is encrypted (AC-6) because the artifacts of a public repository are open to every GitHub user.

**Restore drill** (AC-4), last done on 2026-10-04 on the local test stack (E2E test users and their data), with the
very `run:` scripts of the "Dump user data" and "Check the dump" steps of the dump action (extracted from the YAML) pointed at the local
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
stamps through PostgREST with RLS. Repeat the drill after any change to the dump steps or to the tables. The drill covers the dump and the load, which
the encryption step (AC-6) does not touch; the step's own script is run for real by `tests/backup-workflow.test.ts`, and a dump
comes back byte for byte after `openssl cms -decrypt -binary`.

**Verified on GitHub** on 2026-10-04: a manual run of the workflow against production succeeded in 1 m 19 s
(the runner's Docker pulled the CLI's `pg_dump` image, the session pooler connection worked, the check step
accepted the table list and the artifact `user-data-backup` was stored). **Not verified**: that production's
`postgres` role may set `session_replication_role` when the dump is loaded (if not, delete that first line from
the file; `pg_dump` already orders the tables so that foreign keys hold, but this is untested), and that the
no-secret path ends green with the notice (it ran for the first time when `BACKUP_PUBLIC_KEY` was still missing, so check the run's summary when you add the secrets).

## Coverage

| AC | Test |
| --- | --- |
| AC-1 ... AC-3 | `tests/backup-workflow.test.ts` (schedule and dispatch, the dump command and its exclude list and the check step (both in the action), the weekly artifact and its retention, the no-secret path, the secret handling, and that every table the migrations create is dumped or excluded). That the real run works against production is not asserted: see "Not verified" in Notes |
| AC-6 | `tests/backup-workflow.test.ts` (only the folder of encrypted files is uploaded, after the check; the certificate is read in the encryption step's `env` only; the step run for real with openssl: only `.sql.cms` files are left, the plaintext is gone, the private key restores the dump byte for byte, and a missing, malformed or private-key certificate fails it with nothing to upload; the deploy does not skip itself for a missing certificate and its backup step is not optional) |
| AC-6 (on GitHub) | manual (it needs a real run and the owner's private key): the Backup workflow, run by hand with `BACKUP_PUBLIC_KEY` set, stores `user-data-backup` holding one `.sql.cms` file that the private key decrypts to a dump that ends with `PostgreSQL database dump complete`. Last checked: 2026-10-05 (run 37353976649 from the pull request branch: one `user-data-2026-10-05.sql.cms`, decrypted with the private key to a dump that ends with `PostgreSQL database dump complete` and holds the users and stamps tables; the artifact has no plain text). |
| AC-4 | manual (it restores into a database): the restore drill in Notes. Last checked: 2026-10-04. |
| AC-5 | `tests/backup-workflow.test.ts` (the action is composite with the four inputs, the connection string is read only in the dump step's `env`, the dump and its lists exist only in the action, both callers pass only the connection string, the certificate, the artifact name and the retention) |
| AC-5 (on GitHub) | manual (it needs a real run): the Backup workflow, run by hand, still stores `user-data-backup` now that the dump is in the action, and a Deploy run that applies a migration stores `pre-migration-<sha7>` (both callers hand the connection string over as `db-url: ${{ env.SUPABASE_DB_URL }}`, which only a real run shows to work). Last checked: never recorded. |
