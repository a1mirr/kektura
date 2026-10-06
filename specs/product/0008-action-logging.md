# 0008: Server-side logging of failed actions, and Telegram messages for them

Status: Done
Owner code: `src/lib/log.ts`, `src/lib/failure-alerts.ts`, `src/app/[locale]/dashboard/actions.ts` (the stamp actions)

## Goal

Server actions (the stamp actions first, then feedback, account deletion and friends) deliberately turn every
error into a plain `failed` result for the client (spec 0002 AC-6, AC-7), so a failure would leave no trace.
Each one is logged on the server instead, so production problems can be found in the host's logs. A line in a log
nobody reads is not enough, so the failures that are not expected outcomes also reach the owner on Telegram, in the
chat where the feedback arrives (spec 0017), at most once per kind of failure and hour.

## Behaviour

- **AC-1**: When a stamp action fails because of a database error or a thrown exception, the server
  logs exactly one line via `console.error`, prefixed `[stamp-action]`. The line has the action name
  (`setPlacesStamped`, `setStampDate`, `setExtraStamped` or `setExtraStampDate`), the stage (`read`, `write` or `exception`), the Supabase
  error code and message (or the exception's message), and the user id.
- **AC-2**: Log lines never contain tokens, cookies, emails or request bodies beyond the action name
  and ids.
- **AC-3**: Rejected input (0002 AC-1) is logged once with `console.warn` (`[stamp-action] invalid
  input`) without echoing the input. A missing session (`unauthorized`) is expected and not logged.
- **AC-4**: What the client receives doesn't change.
- **AC-5**: The other server actions that turn errors into a result log through the same file, one line each, under their
  own tag and by the same rules as AC-2: `[feedback]` (spec 0017), `[account-delete]` (spec 0014), `[friends]` (spec
  0024) and `[feature-flags]` (spec 0035: a failed lookup, and each change from the Telegram bot). Which failures each logs is in its own spec; the line formats are below.
- **AC-6**: After logging, the stamp actions, feedback, account deletion and friends also send one Telegram message
  for a failure at the `write` or `exception` stage (account deletion's `rpc` counts as `write`; a friends action is
  a `write` unless something threw around it). Not sent: a failed `read`, a missing session, rejected input, a failed
  feature flag lookup or flag change, and a Telegram request that failed itself. The message goes to the chat of
  `TELEGRAM_CHAT_ID` through `TELEGRAM_BOT_TOKEN` (spec 0017) and only from a production build with both set: on a
  developer's machine and in the tests nothing is sent.
- **AC-7**: A *kind of failure* is the tag, the action and the stage (`[stamp-action] setPlacesStamped write`). Of one
  kind at most one message is sent per hour, counted from the last one sent. The memory of it is the server
  process's (shared by every route of it): a restart forgets it, which at worst sends one more message.
- **AC-8**: When three different kinds fail within a minute (the database is down, everything fails at once), the third
  is replaced by one summary message ("3 kinds of server action failures within a minute. Possibly the database is
  down.") and every other message is paused for an hour. Kinds that were already limited by AC-7 still count towards
  the three.
- **AC-9**: Sending never changes what an action does: it is not waited for, it has the 4 s timeout of every Telegram
  request (spec 0017 AC-5), and an error, a non-2xx answer or a throw anywhere in it is swallowed: the action returns
  the same result and never throws (spec 0002 AC-6, AC-7). A failed send is logged as one line with only a short reason (`[alerts] telegram notification failed reason=http_401`).
- **AC-10**: A message holds the kind of failure, the error's own short `code` (when it has one) and where to look
  (`pm2 logs kektura`), and nothing else: never the error's message (it can quote row values), an email, a user id,
  request input or a Supabase `details` / `hint`, and never the bot token (AC-2 applies to messages as to lines).

## Out of scope

An error-monitoring service (Sentry etc.): it needs an account and a DSN from the user. `src/lib/log.ts`
is the single place to hook one in later.

## Notes

Telegram message formats (plain text, spec 0017; `stage` is `write` or `exception`):

```
Kektura: a server action failed.
[stamp-action] setPlacesStamped write, code 42501
No more messages for this kind for an hour. Details: the server log (pm2 logs kektura).

Kektura: 3 kinds of server action failures within a minute. Possibly the database is down.
No more messages for an hour. Details: the server log (pm2 logs kektura).
```

The first two kinds of an outage are sent as single messages before the third makes it a summary: the alerter does not
hold a message back to see what else fails. The state lives on `globalThis` because Next may load `log.ts` once per
route bundle.

Line formats (one `console.error` / `console.warn` call, or `console.info` for a flag change that went through, one string argument each):

```
[stamp-action] action=setPlacesStamped stage=write user=<uuid> code=42501 message="..."
[stamp-action] invalid input action=setExtraStamped
[feedback] stage=write user=<uuid or anonymous> code=- message="..."
[feedback] telegram notification failed reason=http_401
[account-delete] stage=rpc user=<uuid> code=- message="..."
[friends] action=sendRequest code=- message="..."
[alerts] telegram notification failed reason=http_401
[feature-flags] lookup failed code=- message="..."
[feature-flags] change key=friends change=on result=ok
```

- `user` is `unknown` when the failure happens before the session is known (creating the client or
  reading the user threw); `code` is `-` for exceptions without one.
- The message is JSON-quoted (so a newline in it can't split the line) and capped at 300 characters.
  Only `code` (a short identifier) and `message` of the error are read: a Supabase error's `details`
  and `hint` can quote row values, so they are never logged. A thrown value that isn't an `Error`-like
  object with a `message` is logged as the constant `unknown error`, never stringified.
- Not logged, on purpose: a missing session, a successful action (except a flag change from the Telegram bot, spec 0035 AC-24, which is logged either way), and place keys that match no
  checkpoint (0002 AC-5): that is a bare `failed` without a database error, and AC-3 limits warnings
  to rejected input (0002 AC-1).
- `refresh()` (not `revalidatePath`: spec 0002, notes) throwing after a successful write counts as an `exception` (the client already
  got `failed` for it before this spec).

## Coverage

| AC | Test |
| --- | --- |
| AC-1 ... AC-4 | `src/app/[locale]/dashboard/actions.test.ts`, `describe("spec 0008: ...")` (spies on `console.error` / `console.warn`; the AC-2 test checks that the user's email, the place keys and the error's `details` / `hint` are absent) |
| AC-1 ... AC-3 (line format, one-line guarantee, non-Error values) | `src/lib/log.test.ts` |
| AC-5 | `src/lib/log.test.ts` (the `[feedback]`, `[account-delete]` and `[feature-flags]` lines, spec 0035 AC-24), the actions' own tests (`feedback/actions.test.ts`, `account/actions.test.ts`, `friends/actions.test.ts`) |
| AC-6 ... AC-10 (the rules) | `src/lib/failure-alerts.test.ts` (stages, kinds, the hourly limit, the outage summary, a throwing `send`, the message text) |
| AC-6, AC-7, AC-8, AC-9, AC-10 (through the log functions) | `src/lib/log.test.ts`, `describe("spec 0008: failures reach Telegram")` (what is sent for each action and the chat and URL it goes to, nothing for the excluded failures, the limit, the summary, a hanging, failing or throwing fetch, no token in a log line, nothing without the config or outside production) |
| AC-6 ... AC-10 (the real bot) | manual (it needs the real bot and a production build): see "Checking by hand" below. Last checked: never recorded. |

### Checking by hand

With the bot's `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env.local`, build with `NEXT_PUBLIC_SUPABASE_URL` pointing at a
closed port (it is inlined at build time: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 npm run build`, with `--webpack` in a
worktree), start it with `npm start` and send the feedback form twice. The terminal shows two `[feedback] stage=write`
lines, and one Telegram message arrives (`[feedback] submitFeedback write`, as in the format above, without a code).
