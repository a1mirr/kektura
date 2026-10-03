# 0008: Server-side logging of failed stamp actions

Status: Done
Owner code: `src/app/[locale]/dashboard/actions.ts`, `src/lib/log.ts`

## Goal

Stamp actions deliberately turn every error into `{ ok: false, reason: "failed" }` for the client
(spec 0002 AC-6, AC-7), so a failure would leave no trace. Each one is logged on the server instead, so
production problems can be found in the host's logs.

## Behaviour

- **AC-1**: When a stamp action fails because of a database error or a thrown exception, the server
  logs exactly one line via `console.error`, prefixed `[stamp-action]`. The line has the action name
  (`setPlacesStamped` / `setExtraStamped`), the stage (`read`, `write` or `exception`), the Supabase
  error code and message (or the exception's message), and the user id.
- **AC-2**: Log lines never contain tokens, cookies, emails or request bodies beyond the action name
  and ids.
- **AC-3**: Rejected input (0002 AC-1) is logged once with `console.warn` (`[stamp-action] invalid
  input`) without echoing the input. A missing session (`unauthorized`) is expected and not logged.
- **AC-4**: What the client receives doesn't change.

## Out of scope

An error-monitoring service (Sentry etc.): it needs an account and a DSN from the user. `src/lib/log.ts`
is the single place to hook one in later.

## Notes

Line formats (one `console.error` / `console.warn` call, one string argument each):

```
[stamp-action] action=setPlacesStamped stage=write user=<uuid> code=42501 message="..."
[stamp-action] invalid input action=setExtraStamped
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
