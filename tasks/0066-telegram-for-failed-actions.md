# 0066: Failed server actions reach Telegram

Status: Open
Specs: [0008](../specs/0008-action-logging.md) (edited), [0017](../specs/0017-feedback.md) (relied on: the bot and its notifier)

## Goal

A server action that fails leaves one `[stamp-action]`, `[feedback]`, `[account-delete]` or `[friends]` line in the
droplet's PM2 log (spec 0008) that nobody reads. The owner should hear about it on Telegram, where the feedback
messages and the deploy failures already arrive. Split from task 0060 (production monitoring), where the site
being down is watched by an external service and this part was left open.

## Done when

- [ ] The requirements below written down and their open questions settled with the owner
- [ ] The requirements built, with tests; spec 0008 mirrors the code as built (spec 0034 AC-6)
- [ ] Fresh-context review done

## Requirements

- [ ] **R-1**: `src/lib/log.ts` is the one place a failure passes through; a failure there can also send one
  Telegram message, rate-limited per kind of failure.
- [ ] **R-2**: The logging rules keep holding for the message: no emails, user ids, tokens, request input or Supabase
  `details`/`hint` in it (spec 0008 AC-2), and the Telegram token never reaches a log, a message or an error object
  (CLAUDE.md gotcha: the token is in the request URL; reuse `src/lib/telegram.ts`).
- [ ] **R-3**: A failing or unreachable Telegram never changes what a server action returns to the client and never
  makes it throw (spec 0002 AC-6, AC-7, spec 0008 AC-4).

## Open questions

Decisions needed from the owner before coding:

- What counts as a "kind of failure": the tag plus the action and stage (`[stamp-action] setPlacesStamped write`),
  or the tag only?
- The rate limit: how many messages per kind in how long, and where it is kept. The server is one PM2 process, so
  memory is simplest, but a restart forgets it; a database row would survive but adds a write to a failing path.
- Which failures deserve a message at night: all of them, or only `write` and `exception` stages, not the expected
  ones (`unauthorized`, invalid input, spec 0008 AC-3)?
- Whether to send anything while the database itself is down (every action fails at once): one summary or the rate limit
  alone.
- The text of the message, and which of the bot's chats it goes to (the feedback chat of spec 0017 or another).

## Spec changes

Filled in when built.

## Notes

- Alternatives left out by task 0060: an error-monitoring service such as Sentry (account, DSN, personal data in
  stack traces, a dependency on a 1 GB server).
