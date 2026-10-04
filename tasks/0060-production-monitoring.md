# 0060: Know when production is broken

Status: In progress
Specs: [0066](../specs/0066-uptime-monitoring.md) AC-1 to AC-5 (new); [0026](../specs/0026-automatic-deploy.md) AC-8, AC-9 (relied on: the smoke test's checks and the Telegram message)

## Goal

Today production is blind between deploys. The deploy's smoke test runs once, after a deploy. A server action that
fails leaves one `[stamp-action]` line in the droplet's PM2 log (spec 0008) that nobody reads, and if the site
goes down at night, the first to know is a user. The owner should hear about it, on Telegram where the deploy
failures already arrive.

## Done when

- [x] ~~The requirements below written down and their open questions settled with the owner~~ Not asked beforehand: the task's own recommendation (options 1 and 2 first, no new accounts) was followed for option 1, and the owner sees the choice in the pull request. Option 2 is still an open question (below).
- [x] Option 1 built: the uptime workflow, its alert script and tests (spec 0066)
- [ ] Option 2 (failed actions to Telegram) decided and built, or dropped
- [x] The specs listed above mirror the code as built (spec 0034 AC-6)
- [ ] Fresh-context review done

## Options to decide between

1. **Uptime check from GitHub Actions**: a scheduled workflow runs the existing `scripts/smoke-test.mjs` against
   the public site every 15 minutes and tells the owner through the existing `scripts/notify-telegram.mjs` when it
   fails twice in a row. No new account and no new secret. GitHub's cron is best-effort (runs can be delayed by
   minutes) and an idle repository's schedules are disabled after 60 days without activity. **Built here.**
2. **Failed actions to Telegram**: `src/lib/log.ts` is the one place a failure passes through; it could send one
   rate-limited message per kind of failure. It must keep the logging rules (no emails, ids, tokens, input,
   Supabase `details`/`hint`), and the Telegram token must never reach a log (CLAUDE.md gotcha).
3. **Sentry (or similar) free tier**: richer (stack traces, grouping) but needs an account, a DSN, and a look at
   what personal data a stack trace can carry; adds a dependency to a 1 GB server.
4. **An external uptime service** (UptimeRobot and similar, free): checks every 5 minutes from outside, no code.

Recommendation: 1 and 2 first (no new accounts, built on what exists); 3 only if 2 turns out too thin.

## Open questions

- **Option 2**: not built, because the text does not settle its design (what counts as a "kind of failure", the
  rate limit and whether it is kept in the memory of one PM2 process, which failures are worth a night-time
  message, and that it puts a Telegram call into the production server's error paths). Build it, drop it, or take
  option 3 or 4 instead?
- **Option 1, as built**: the second failed run in a row means two completed runs of the workflow, about 15 minutes
  apart, each retried for a minute; a longer outage gets no reminder and a recovery gets no message (both stated in
  spec 0066). Say if either is wanted.

## Spec changes

- New spec [0066](../specs/0066-uptime-monitoring.md) (AC-1 to AC-5, a `manual` coverage row for a real scheduled
  run) for the uptime workflow, the alert rule and the message; the index in `specs/README.md` has its row.
- No change to spec 0026: the smoke test and the Telegram message it relies on behave as before (the smoke
  script's header says the uptime check shares its checks).

## Notes

- Built on a topic branch with only unit tests and a read of the YAML: the workflow has not run, and nothing
  was probed on production. It needs no new secret; it uses `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` when they
  exist. `deploy/README.md`, "Uptime check", has the owner's side (re-enabling a switched-off schedule).
