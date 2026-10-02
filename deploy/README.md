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

Never set `TEST_LOGIN` here: it switches on the dummy login (the app also requires a localhost database).
Server-only values (`SITE_URL`, `TELEGRAM_*`) take effect with `pm2 restart kektura --update-env`.

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

## Deploying

1. **Apply the database migrations first.** The hook never touches the database: code that needs a table
   or policy that production doesn't have yet fails at runtime (this has happened: the feedback and
   account-deletion code was ready before migration 0008 was applied). Order: migration, then push.
2. `git push production main`. Only pushes to `main` deploy; other branches are just stored.
3. The hook checks out `main`, runs `npm ci`, `npm run build`, then `pm2 reload kektura`. It stops at the
   first failing step, so a failed install or build never reloads the app. The build takes minutes on this
   server.

If the hook changed, copy the new `deploy/post-receive` to `~/kektura.git/hooks/` on the server.

## When something is wrong

- Logs: `pm2 logs kektura` (stamp and feedback failures are `[stamp-action]`, `[feedback]`,
  `[account-delete]` lines), `pm2 status`, `sudo journalctl -u caddy`.
- Roll back: revert the bad commit on `main` and push (`git revert <sha> && git push production main`). In an
  emergency `git push --force production <good-sha>:main` redeploys an older commit; the force only
  concerns this deploy remote, not GitHub.
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
