# Production server

How kektura-tracker.com runs, and how to deploy it. (Spec 0020. The test server and E2E setup are in the
root README and spec 0006: they have nothing to do with this.)

## What runs where

| Part | Where |
| --- | --- |
| App | DigitalOcean droplet `188.166.117.212`, Ubuntu 22.04, 1 GB RAM plus 2 GB swap, Node 22 (nvm), PM2 process `kektura` on port 3000 |
| Proxy and HTTPS | Caddy: `deploy/Caddyfile`, ports 80 and 443 to `127.0.0.1:3000` |
| DNS | Cloudflare, proxy **off** (grey cloud) so Caddy can get its certificate |
| Database and sign-in | Supabase cloud project (not on the server) |
| Code on the server | `~/kektura.git` (bare repository, receives pushes) and `~/kektura_app` (checked out and built by the hook) |

## Environment variables

In `~/kektura_app/.env.local` on the server (never committed; `.env.example` has the names):

| Variable | Needed for | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the app | public values, compiled into the build: **rebuild** after changing them |
| `SITE_URL` | redirects (spec 0020) | `https://kektura-tracker.com`; optional, without it the proxy's forwarded headers are used |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | feedback notifications (spec 0017) | secrets; server-only. Check with `npm run telegram:check` |
| `TELEGRAM_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` | flag commands from the Telegram bot (spec 0035) | secrets; server-only. The first is a string of your own (A-Z a-z 0-9 _ -, up to 256 characters) that Telegram sends back with every update; the second is the Supabase project's service role (secret) key, used by `/api/telegram` only. Without the first, `/api/telegram` answers 404; without the second, the bot says the commands are not configured |

Never set `TEST_LOGIN` here: it switches on the dummy login (the app also requires a localhost database).
Server-only values (`SITE_URL`, `TELEGRAM_*`, `SUPABASE_SERVICE_ROLE_KEY`) take effect with `pm2 restart kektura --update-env`.

## Flag commands from Telegram

Spec 0035: the owner writes to the feedback bot to look at and switch feature flags (`/flags`, `/flag friends allowlist`, `/allow friends me@example.com`; anything else shows the help). Once, after a deploy that has the route:

1. Add `TELEGRAM_WEBHOOK_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` to `~/kektura_app/.env.local` (the `.env.example` comment says what they are), then `pm2 restart kektura --update-env`.
2. From a checkout that has the same values for `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` and `SITE_URL=https://kektura-tracker.com` in its `.env.local`: `npm run telegram:webhook -- set`, then `npm run telegram:check`, which says where the webhook points.
3. Send `/flags` to the bot.

The webhook listens for messages and for taps on the panel's buttons: after a release that adds a kind of update, as buttons did, run `-- set` again. `npm run telegram:webhook -- info` shows where Telegram sends the messages and the last error it had; `-- delete` stops it. While a webhook is registered Telegram refuses `getUpdates`, so `npm run telegram:check -- --find-chat-id` needs `-- delete` first.

## First-time setup

1. `sudo bash server-setup.sh`: swap space and log clean-up (the build needs the swap on 1 GB).
2. Node and PM2: install nvm and Node 22, then `npm install -g pm2` and `pm2 startup`.
3. Caddy:
   ```bash
   sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
   curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/gpg.key" | sudo gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt" | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt-get update && sudo apt-get install -y caddy
   sudo cp Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy
   ```
4. The repository: `git init --bare ~/kektura.git`, copy `post-receive` to `~/kektura.git/hooks/post-receive`
   and `chmod +x` it.
5. Create `~/kektura_app/.env.local` (above).
6. On your computer: `git remote add production a1mirr@188.166.117.212:~/kektura.git`.

## Automatic deploys

(Spec 0026.) Nothing to do after a merge: when CI is green on `main`, `.github/workflows/deploy.yml` runs, and

1. compares the commit with the one production runs and **skips** it when only docs, specs, tests and repository
   tooling changed (`specs/`, `tests/`, `e2e/`, `.github/`, `.claude/`, `.githooks/`, `*.md`);
2. when a migration is missing (the migration script's own dry run says so), **backs up the user data first**: the
   six tables of the weekly backup (spec 0012) are dumped by the same action
   (`.github/actions/dump-user-data`) into the workflow artifact `pre-migration-<sha7>` of that run, kept 30 days
   and encrypted to the public certificate in the repository secret `BACKUP_PUBLIC_KEY` (the artifacts of a public
   repository are open to everyone; how to make the key pair: spec 0012, Notes); a dump that fails or does not pass its
   check, or a missing certificate, stops the deploy before any migration runs. A deploy with no migration takes no
   dump and needs no certificate. To restore after a bad migration see spec 0012 ("After a bad migration"). The upload never
   overwrites, so re-running the failed jobs of a run that already stored its backup fails at the upload: start a new
   run by hand instead (Deploy, Run workflow, `dry_run` unticked);
3. applies the **migrations** production is missing (`scripts/migrate-production.mjs`, name order, each file in
   its own transaction, recorded in `public.applied_migrations`);
4. **pushes** the commit to the `production` remote, so the hook below builds it and reloads the app;
5. runs a **smoke test** (`scripts/smoke-test.mjs`: every language's page answers 200, an unknown page 404, and a POST to the test server's dummy login `/auth/test-login`
   404, retried for two minutes);
6. on any failure stops, writes in the job summary what state things are in, and sends a Telegram message when the
   bot secrets exist. Nothing rolls back by itself.

Run it by hand from the Actions tab (Deploy, Run workflow): with `dry_run` ticked (the default) it only says what it
would do. A migration must work with the code that is still running while it is applied, so dropping or renaming
something the app uses takes two merges, the second after the first has deployed.

### One-time setup

**Done on 2026-10-03**: the key is installed on the droplet, the three deploy secrets are set and the baseline
`0024_friends.sql` is recorded (by a first real run that also deployed and passed the smoke test). Repeat the steps only
to rotate the key. Until the three deploy secrets of step 5 (`DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `SUPABASE_DB_URL`) exist, the workflow ends with a notice and deploys nothing.

1. On your computer: `ssh-keygen -t ed25519 -N "" -C github-actions-deploy -f gha-deploy` (two files: the private
   key `gha-deploy` and the public key `gha-deploy.pub`).
2. On the server: `mkdir -p ~/bin`, copy `deploy/ssh-gate.sh` there as `~/bin/deploy-gate` and `chmod +x` it. It is
   the forced command of the key: whatever the key is asked to run, it can only push to `~/kektura.git` and read
   its refs.
3. On the server, add one line to `~/.ssh/authorized_keys` (the public key after the options):
   `restrict,command="/home/a1mirr/bin/deploy-gate" ssh-ed25519 AAAA... github-actions-deploy`
4. Check from your computer: `GIT_SSH_COMMAND="ssh -i gha-deploy -o IdentitiesOnly=yes" git ls-remote a1mirr@188.166.117.212:~/kektura.git`
   lists the refs, and `ssh -i gha-deploy -o IdentitiesOnly=yes a1mirr@188.166.117.212` is refused with the gate's message.
5. In GitHub, Settings, Secrets and variables, Actions, add repository secrets: `BACKUP_PUBLIC_KEY` (the backup certificate, see above), `DEPLOY_SSH_KEY` (the whole private
   key file), `DEPLOY_KNOWN_HOSTS` (the output of `ssh-keyscan -t ed25519 188.166.117.212`; compare its fingerprint
   with `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the server) and `SUPABASE_DB_URL` (it exists for the
   backup: the session pooler string of the `postgres` role, which can change the schema). Optional:
   `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` (the same bot as the feedback form) for failure messages.
6. Delete the two deploy key files (`gha-deploy` and `gha-deploy.pub`) from your computer. Keep the backup private key (`backup-private.pem`, spec 0012, Notes): without it no backup can be opened.
7. **First run**, because the migration script never guesses what production has: check in Supabase that production
   has every file in `supabase/migrations/` (today the newest is `0024_friends.sql`). Then run Deploy by hand with
   `dry_run` ticked and `baseline` set to that file name and read the summary; run it again with `dry_run` unticked:
   that records the files up to the baseline as applied (without running them) and deploys. After that every merge
   works by itself. Without the baseline the first automatic run fails with "no record of applied migrations".

Rotate the key by repeating steps 1 to 6 and removing the old line from `authorized_keys`.

## Deploying by hand (the fallback)

Only for a rollback or when the workflow is broken. The workflow does the same two things in the same order.

1. **Apply the database migrations first.** The hook never touches the database: code that needs a table
   or policy that production doesn't have yet fails at runtime (this has happened: the feedback and
   account-deletion code was ready before migration 0008 was applied). Order: migration, then push. **Record each
   file you applied** by hand in the workflow's table, or the next automatic run applies it a second time and
   fails: `insert into public.applied_migrations (file_name) values ('0031_x.sql');` (the file name as in
   `supabase/migrations/`).
2. `git push production main`. Only pushes to `main` deploy; other branches are just stored.
3. The hook checks out `main`, runs `npm ci`, `npm run build` (with `NODE_OPTIONS=--max-old-space-size=1536`: the default heap of about 480 MB runs out on this 1 GB server), then `pm2 reload kektura`. It stops at the
   first failing step, so a failed install or build never reloads the app. The build takes minutes on this
   server.

If the hook changed, copy the new `deploy/post-receive` to `~/kektura.git/hooks/` on the server.

## After the seeds change

The automatic deploy does not apply seeds: regenerated trail data (spec 0004) goes to production by hand, around
the merge that ships the code that needs it.

The dashboard caches the checkpoints and extra stamps on the server for up to 24 hours (spec 0002 AC-15), on
disk as well as in memory, so the cache survives deploys and restarts. After applying changed seeds to
production (spec 0004), delete the cache folder and restart, otherwise old places are served for up to a day:

```
rm -rf ~/kektura_app/.next/cache/fetch-cache
pm2 restart kektura
```

## Watching the site from outside

(Issue #87, "0060".) The deploy's smoke test runs once, after a deploy; between deploys an external uptime service watches
the site. It is not part of the repository and is set up by the owner in the service's own account: no service is
required (UptimeRobot and Better Stack are examples), and the free tiers of such services change, so check what a
free account allows before relying on it. A GitHub Actions cron was tried and dropped: every 15 minutes is about
2,880 billed minutes a month against 2,000 on the Free plan for private repositories, which would stop CI and deploys.

- **What to monitor**: a plain HTTP check of the site's main pages, `https://kektura-tracker.com/en` and
  `https://kektura-tracker.com/ru`, expecting a 200 answer. Nothing deeper is needed: the smoke test's other checks
  (an unknown page is a 404, the dummy login is absent) belong to the deploy.
- **Interval**: 5 minutes.
- **Alerts**: to Telegram, through the service's own Telegram contact or integration (the owner links it to their
  own chat there). It does not use the repository's bot or its `TELEGRAM_*` secrets.
- **Secrets**: none go into the repository, the workflows or the server: the account, its API keys and the Telegram
  link live in the service.
- Failed server actions are not seen by this: they only leave a log line (`pm2 logs kektura`, below).

## When something is wrong

- Logs: `pm2 logs kektura` (stamp and feedback failures are `[stamp-action]`, `[feedback]`,
  `[account-delete]` lines), `pm2 status`, `sudo journalctl -u caddy`.
- Roll back: revert the pull request on `main` and merge the revert: the workflow deploys it. By hand: `git revert <sha> && git push production main`. In an
  emergency `git push --force production <good-sha>:main` redeploys an older commit; the force only
  concerns this deploy remote, not GitHub. After such a rollback the next merge deploys `main` again, the bad
  commit included, so merge the revert first.
- The server's build failed but the push went through (the workflow fails with "The server did not report a deploy"):
  production's `main` already points at that commit, so re-running the workflow skips it. Merge a fix, or rebuild
  without a new commit by running the hook by hand on the server: `echo "0 0 refs/heads/main" | ~/kektura.git/hooks/post-receive`.
- A failed build has already replaced part of `.next`: the running app can misbehave until the next good
  build, even though the hook stopped before reloading.

## Notes

- `HOSTNAME=188.166.117.212` is set by the hook when it (re)starts PM2. It stops Next.js from rewriting
  `request.url` to `localhost` during the auth callbacks. With `SITE_URL` set (see above) the redirects no
  longer depend on it; it can be removed once that has been tried on the server.
- An Xray VPN used to listen on port 443. It was disabled (`sudo systemctl disable --now xray`) so that
  Caddy can serve HTTPS there. The earlier `caddy_setup.sh`, `caddy_fix.sh` and `final_caddy.sh` at the root
  of the repository did the Caddy install, a temporary HTTP-only configuration and that switch; they are
  replaced by the steps and the `Caddyfile` here.
