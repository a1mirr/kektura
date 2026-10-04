# 0066: Uptime check

Status: Done
Owner code: `.github/workflows/uptime.yml`, `scripts/uptime-alert.mjs`, `scripts/lib/uptime.mjs`,
`scripts/smoke-test.mjs`, `scripts/notify-telegram.mjs`, `deploy/README.md`

## Goal

Production is watched between deploys: a scheduled GitHub Actions workflow asks the public site the same questions
as the deploy's smoke test (spec 0026 AC-8) every 15 minutes, and the owner hears about an outage on Telegram, where
the deploy failures already arrive (spec 0026 AC-9), without a new account or a new secret.

## Behaviour

- **AC-1**: The workflow `.github/workflows/uptime.yml` runs every 15 minutes on a schedule and by hand
  (`workflow_dispatch`), and for nothing else (no pull request, push or other workflow). Its token can only read the
  repository and its workflow runs, and the job has a time limit.
- **AC-2**: Each run runs `scripts/smoke-test.mjs` against `https://kektura-tracker.com`, retried for a minute so
  the seconds of a reload after a deploy are not an outage: the same checks as after a deploy (`/en` and `/ru` answer
  200, an unknown page 404, the dummy login 404). A check that still fails after the minute fails the run.
- **AC-3**: When the site check failed, the run tells the owner on Telegram only if it is the second failed run in
  a row: the last completed run before it failed or timed out, and the one before that did not. So one blip sends nothing, an outage is announced once, and a recovery followed by a new
  outage is announced again. A cancelled or skipped run counts as not failed. Only one run goes at a time, so the
  runs before this one have finished.
- **AC-4**: When the earlier runs cannot be read (GitHub's API does not answer), the message is sent: a message that
  was not needed costs less than an outage nobody heard about.
- **AC-5**: The message says that production looks down, that the check failed on two runs in a row, and links to the
  run, whose log has what failed. It goes through `notify` of `scripts/notify-telegram.mjs`, the one place that sends
  to Telegram, so neither the bot token nor the request URL is ever printed. The bot secrets `TELEGRAM_BOT_TOKEN` and
  `TELEGRAM_CHAT_ID` are optional and only referenced in the `env` of the one step that sends; without them nothing
  is sent and the red run (with GitHub's own failure e-mail) is the only signal. The workflow needs no other secret.

## Out of scope

Failed server actions (spec 0008 lines that nobody reads) and an error-monitoring service or external uptime service:
they need a decision of their own. Watching the database or the Supabase sign-in separately from the site. A
recovery message.

## Notes

- GitHub's cron is best-effort: a run can start minutes late or be dropped when GitHub is busy, so "15 minutes" is
  the schedule, not a guarantee, and "two in a row" means two completed runs of this workflow, not a time span.
- GitHub switches off the schedule of a repository after 60 days without activity (its documentation names public
  repositories; this one is private, but the check does not rely on that); the owner re-enables it from the
  Actions tab (`deploy/README.md`, "Uptime check").
- The smoke test's checks are shared: a change to `CHECKS` in `scripts/smoke-test.mjs` changes the deploy's check
  and this one together.
- Each run prints the smoke test's attempts in its log and in the job summary (`### Smoke test`).
- A failed step other than the site check (checkout, Node setup) fails the run too and so counts as a failed run for
  the rule, but sends no message by itself.

## Coverage

| AC | Test |
| --- | --- |
| AC-1 | `tests/uptime.test.ts` (reads the workflow file) |
| AC-2 | `tests/uptime.test.ts` (the workflow's step and the smoke test's checks against a fake site) |
| AC-3 | `tests/uptime.test.ts` (the rule for every combination of previous conclusions, the workflow's lookup, the script against a fake Telegram API) |
| AC-4 | `tests/uptime.test.ts` |
| AC-5 | `tests/uptime.test.ts` (message text, no bot, the token never printed, where the secrets are referenced) |
| AC-3 and AC-5 on GitHub (a real scheduled run, the real message arriving, the schedule resuming after a pause) | manual (needs GitHub's scheduler and the production bot, which no test reaches): run the workflow from the Actions tab (Uptime, Run workflow) while the site answers and confirm it is green, then read the next scheduled runs. The message itself is the same `notify` call as the deploy failure message and is covered by tests. Last checked: never recorded |
