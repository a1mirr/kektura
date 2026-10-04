# 0043: Know when production is broken

Status: Open
Specs: none yet (a spec for the area is drafted first, with the owner, before anything is built)

## Goal

Today production is blind between deploys. The deploy's smoke test runs once, after a deploy. A server action that
fails leaves one `[stamp-action]` line in the droplet's PM2 log (spec 0008) that nobody reads, and if the site
goes down at night, the first to know is a user. The owner should hear about it, on Telegram where the deploy
failures already arrive.

## Done when

- [ ] A spec (new, "Production monitoring") with numbered acceptance criteria, its open questions settled with the owner
- [ ] The decisions below are made and built
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6)

## Options to decide between

1. **Uptime check from GitHub Actions**: a scheduled workflow runs the existing `scripts/smoke-test.mjs` against
   the public site every 15 minutes and tells the owner through the existing `scripts/notify-telegram.mjs` when it
   fails twice in a row. No new account and no new secret. GitHub's cron is best-effort (runs can be delayed by
   minutes) and an idle repository's schedules are disabled after 60 days without activity.
2. **Failed actions to Telegram**: `src/lib/log.ts` is the one place a failure passes through; it could send one
   rate-limited message per kind of failure. It must keep the logging rules (no emails, ids, tokens, input,
   Supabase `details`/`hint`), and the Telegram token must never reach a log (CLAUDE.md gotcha).
3. **Sentry (or similar) free tier**: richer (stack traces, grouping) but needs an account, a DSN, and a look at
   what personal data a stack trace can carry; adds a dependency to a 1 GB server.
4. **An external uptime service** (UptimeRobot and similar, free): checks every 5 minutes from outside, no code.

Recommendation: 1 and 2 first (no new accounts, built on what exists); 3 only if 2 turns out too thin.

## Spec changes

Filled in when built.
