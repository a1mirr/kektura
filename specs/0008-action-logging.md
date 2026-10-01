# 0008: Server-side logging of failed stamp actions

Status: Accepted
Owner code: `src/app/[locale]/dashboard/actions.ts`, `src/lib/log.ts`

## Goal

Stamp actions deliberately turn every error into `{ ok: false, reason: "failed" }` for the client
(spec 0002 AC-6, AC-7), so today a failure leaves no trace anywhere. Log them on the server so
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

## Coverage

| AC | Test |
| --- | --- |
| AC-1 ... AC-4 | `src/app/[locale]/dashboard/actions.test.ts` (spy on `console.error` / `console.warn`) |
