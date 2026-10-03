# 0020: Request origin behind the proxy, and the deployment files

Status: Done
Owner code: `src/lib/origin.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/sign-out/route.ts`,
`src/app/auth/test-login/route.ts`, `deploy/`

## Goal

Behind Caddy, `request.url` of a route handler says `localhost`, so redirects built from it send the user to
the wrong address. Commits `6009201` and `4334067` fixed that by pasting the same few lines into two route
handlers: they trust `x-forwarded-host` and `host` as they come (a missing host gives `http://null/…`) and
assume `http` when `x-forwarded-proto` is absent. Make that one tested helper, and put the server scripts
that were added to the repository root in one place, in a form that can't deploy a broken build.

## Behaviour

### The public origin of a request

- **AC-1**: `requestOrigin(request)` is the one place that decides the origin (`scheme://host[:port]`) for
  redirects in route handlers. In order:
  1. `SITE_URL`, if set to a valid `http(s)` URL: its origin, whatever the request says;
  2. the `x-forwarded-proto` and `x-forwarded-host` headers (first value of a list), with `host` when
     there is no forwarded host and the request's own scheme when there is no forwarded proto;
  3. the origin of `request.url`.
  A Server Component, which has the headers but no request (the invite link on `/friends`, spec 0024), calls
  `originFromHeaders(headers, own)`: the same rules, `own` standing in for `request.url`.
- **AC-2**: Header values are only used when they look like a scheme (`http`, `https`) and a host name or
  address with an optional port; anything else (`evil.com/path`, `a@b`, spaces, `javascript`) is ignored and
  the next step is used. It never produces `null` or `undefined` parts.
- **AC-3**: The OAuth callback, sign-out and dummy-login routes use it, so a redirect always leads back to the
  site the user is on, in production and in the test environments.

### Deployment files

- **AC-4**: `deploy/` holds what runs on the production server, nothing else lives at the repository root:
  `post-receive` (the git hook), `Caddyfile` (the one proxy configuration, HTTPS), `server-setup.sh` (swap
  space and log clean-up, safe to run again) and `README.md` (how production is built, the environment
  variables, how to deploy, roll back and read logs).
- **AC-5**: The deploy hook stops at the first failing step (`set -euo pipefail`), so a failed install or
  build never reloads the running app; it deploys only pushes to `main`.
- **AC-6**: The three obsolete root scripts (`caddy_setup.sh`, `caddy_fix.sh`, `final_caddy.sh`: three
  different Caddy configurations, one of them HTTP only) are gone; what they did once is in the README.

## Out of scope

Changing how production runs (PM2, Caddy, the `HOSTNAME` variable): the files are documented and made safe,
not redesigned. Building into a separate directory and swapping it in (a zero-downtime deploy) would need to
be tried on the server first.

## Notes

- `SITE_URL` is optional: without it the forwarded headers are used, as before, so nothing changes until
  it is set. Setting it (`.env.local` on the server, then restart) makes the redirects independent of
  request headers entirely.
- Why the headers are checked at all: a redirect built from a header the client controls can only send
  that client elsewhere (a cross-site request can't set `host`), so this is hardening, not a hole fix.
- The hook is a copy: git hooks live in `~/kektura.git/hooks/` on the server. After changing
  `deploy/post-receive`, copy it there (README).
- A failed `next build` already replaced part of `.next` when it stops, so a running instance can break
  until the next good build even when the hook stops before reloading. Roll back by pushing the last good
  commit (README).

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2 | `src/lib/origin.test.ts` |
| AC-3 | `e2e/auth.spec.ts` (sign-out and dummy login redirect to the right place); the callback needs a real OAuth round trip: manual |
| AC-4, AC-6 | review of `deploy/` |
| AC-4, AC-5 | `tests/deploy.test.ts` (files in place, the hook fails fast and deploys only main, HTTPS proxy config, the README's contents); by hand: `bash -n` on both scripts and a dry run of the hook's branch filter (main deploys; another branch and a tag don't) |
