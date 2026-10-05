# 0008: Server-side logging of failed actions

Status: Done
Owner code: `src/lib/log.ts`, `src/app/[locale]/dashboard/actions.ts` (the stamp actions)

## Goal

Server actions (the stamp actions first, then feedback, account deletion and friends) deliberately turn every
error into a plain `failed` result for the client (spec 0002 AC-6, AC-7), so a failure would leave no trace.
Each one is logged on the server instead, so production problems can be found in the host's logs.

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

## Out of scope

An error-monitoring service (Sentry etc.): it needs an account and a DSN from the user. `src/lib/log.ts`
is the single place to hook one in later.

## Notes

Line formats (one `console.error` / `console.warn` call, one string argument each):

```
[stamp-action] action=setPlacesStamped stage=write user=<uuid> code=42501 message="..."
[stamp-action] invalid input action=setExtraStamped
[feedback] stage=write user=<uuid or anonymous> code=- message="..."
[feedback] telegram notification failed reason=http_401
[account-delete] stage=rpc user=<uuid> code=- message="..."
[friends] action=sendRequest code=- message="..."
[feature-flags] lookup failed code=- message="..."
[feature-flags] change key=friends change=on result=ok
```

- `user` is `unknown` when the failure happens before the session is known (creating the client or
  reading the user threw); `code` is `-` for exceptions without one.
- The message is JSON-quoted (so a newline in it can't split the line) and capped at 300 characters.
  Only `code` (a short identifier) and `message` of the error are read: a Supabase error's `details`
  and `hint` can quote row values, so they are never logged. A thrown value that isn't an `Error`-like
  object with a `message` is logged as the constant `unknown error`, never stringified.
- Not logged, on purpose: a missing session, a successful action, and place keys that match no
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
