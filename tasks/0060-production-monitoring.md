# 0060: Know when production is broken

Status: Done
Specs: none

## Goal

Today production is blind between deploys. The deploy's smoke test runs once, after a deploy. A server action that
fails leaves one `[stamp-action]` line in the droplet's PM2 log (spec 0008) that nobody reads, and if the site
goes down at night, the first to know is a user. The owner should hear about it, on Telegram where the deploy
failures already arrive.

## Done when

- [x] The decision is made (owner, 2026-10-04): option 4, an external uptime service
- [x] The external monitor is written up for the owner in `deploy/README.md` ("Watching the site from outside"); the owner creates the account and the monitor
- [x] Option 1 struck with its reason, option 2 moved to its own task (0066)
- [x] No spec states a rule this task changes (see Spec changes)
- [x] Fresh-context review done

## Options

1. ~~**Uptime check from GitHub Actions**: a scheduled workflow runs the existing `scripts/smoke-test.mjs` against
   the public site every 15 minutes and tells the owner through `scripts/notify-telegram.mjs`.~~ Dropped: a 15-minute
   cron is about 2,880 billed minutes a month, and the Free plan has 2,000 for private repositories, so it would stop
   CI and deploys. (It was built on this branch first and removed.)
2. ~~**Failed actions to Telegram** from `src/lib/log.ts`.~~ Moved to task [0066](0066-telegram-for-failed-actions.md).
3. ~~**Sentry (or similar) free tier**~~ Not chosen: needs an account, a DSN, a look at what personal data a stack
   trace can carry, and adds a dependency to a 1 GB server.
4. **An external uptime service** (UptimeRobot, Better Stack and similar, free): checks every 5 minutes from
   outside, no code. **Chosen**; written up in `deploy/README.md`, "Watching the site from outside". No service is
   required by the repository; free-tier limits change, so the owner checks them.

## Spec changes

None. The change is a section of `deploy/README.md` and no spec states a rule it changes (spec 0026 owns the deploy's
smoke test, which is untouched).

## Notes

- The service, its account and its Telegram link are the owner's: nothing about them is in the repository, and no
  secret is needed here.
- This task is Done when the setup is written down; the monitor itself is the owner's step, and until the owner has created it a site outage is still noticed by a user first.
