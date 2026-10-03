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
| `FF_FRIENDS` | friends feature flag (spec 0024) | `1` switches the Friends pages, the dashboard link and the About paragraph on; unset = off. Read on every request: a restart applies it, no rebuild |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | feedback notifications (spec 0017) | secrets; server-only. Check with `npm run telegram:check` |

Never set `TEST_LOGIN` here: it switches on the dummy login (the app also requires a localhost database).
Server-only values (`SITE_URL`, `FF_FRIENDS`, `TELEGRAM_*`) take effect with `pm2 restart kektura --update-env`.

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
2. applies the **migrations** production is missing (`scripts/migrate-production.mjs`, name order, each file in
   its own transaction, recorded in `public.applied_migrations`);
3. **pushes** the commit to the `production` remote, so the hook below builds it and reloads the app;
4. runs a **smoke test** (`scripts/smoke-test.mjs`: `/en` and `/ru` answer 200, an unknown page 404, retried for
   two minutes);
5. on any failure stops, writes in the job summary what state things are in, and sends a Telegram message when the
   bot secrets exist. Nothing rolls back by itself.

Run it by hand from the Actions tab (Deploy, Run workflow): with `dry_run` ticked (the default) it only says what it
would do. A migration must work with the code that is still running while it is applied, so dropping or renaming
something the app uses takes two merges, the second after the first has deployed.

### One-time setup

Until the three secrets in step 5 exist, the workflow ends with a notice and deploys nothing.

1. On your computer: `ssh-keygen -t ed25519 -N "" -C github-actions-deploy -f gha-deploy` (two files: the private
   key `gha-deploy` and the public key `gha-deploy.pub`).
2. On the server: `mkdir -p ~/bin`, copy `deploy/ssh-gate.sh` there as `~/bin/deploy-gate` and `chmod +x` it. It is
   the forced command of the key: whatever the key is asked to run, it can only push to `~/kektura.git` and read
   its refs.
3. On the server, add one line to `~/.ssh/authorized_keys` (the public key after the options):
   `restrict,command="/home/a1mirr/bin/deploy-gate" ssh-ed25519 AAAA... github-actions-deploy`
4. Check from your computer: `GIT_SSH_COMMAND="ssh -i gha-deploy -o IdentitiesOnly=yes" git ls-remote a1mirr@188.166.117.212:~/kektura.git`
   lists the refs, and `ssh -i gha-deploy -o IdentitiesOnly=yes a1mirr@188.166.117.212` is refused with the gate's message.
5. In GitHub, Settings, Secrets and variables, Actions, add repository secrets: `DEPLOY_SSH_KEY` (the whole private
   key file), `DEPLOY_KNOWN_HOSTS` (the output of `ssh-keyscan -t ed25519 188.166.117.212`; compare its fingerprint
   with `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the server) and `SUPABASE_DB_URL` (it exists for the
   backup: the session pooler string of the `postgres` role, which can change the schema). Optional:
   `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` (the same bot as the feedback form) for failure messages.
6. Delete the two key files from your computer.
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
3. The hook checks out `main`, runs `npm ci`, `npm run build`, then `pm2 reload kektura`. It stops at the
   first failing step, so a failed install or build never reloads the app. The build takes minutes on this
   server.

If the hook changed, copy the new `deploy/post-receive` to `~/kektura.git/hooks/` on the server.

## After the seeds change

The dashboard caches the checkpoints and extra stamps on the server for up to 24 hours (spec 0009), on
disk as well as in memory, so the cache survives deploys and restarts. After applying changed seeds to
production (spec 0004), delete the cache folder and restart, otherwise old places are served for up to a day:

```
rm -rf ~/kektura_app/.next/cache/fetch-cache
pm2 restart kektura
```

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
