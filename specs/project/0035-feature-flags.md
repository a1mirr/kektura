# 0035: Feature flags

Status: Done
Owner code: `src/lib/feature-flags.ts`, `src/lib/feature-flags-server.ts`, `supabase/migrations/0060_feature_flags.sql`,
`e2e/feature-flags.spec.ts`, `e2e/helpers.ts`, `playwright.config.ts`, `src/app/api/telegram/route.ts`, `src/lib/flag-commands.ts`,
`src/lib/telegram-webhook.ts`, `src/lib/supabase/service.ts`, `scripts/telegram-webhook.mjs`,
`supabase/migrations/0062_flag_admin.sql`

## Goal

An unfinished or risky feature can be merged and deployed to production while staying invisible, then be switched on
for the developer, for chosen testers and for everybody, without a deploy (the server is small and a deploy takes
minutes). A flag is temporary: once its feature is live for everyone, the flag, its checks and its rows are deleted.
Which flags exist is declared in code; how each one is switched is stored in the database. The developer can look at and
switch them from the phone by writing to the Telegram bot that already brings the feedback.

## Behaviour

### Declaring a flag

- **AC-1**: Every flag is declared once in the registry `FLAGS` of `src/lib/feature-flags.ts`: a kebab-case key, a
  one-line description and a default mode (`off` unless stated). The type of a flag key is derived from the registry,
  so asking for a flag that is not declared fails typecheck.
- **AC-2**: A flag has one of three modes: `off` (nobody), `allowlist` (only the users listed for it) or `on` (everybody,
  signed-out visitors included). A flag with no stored row has its registry default.

### Resolving a flag

- **AC-3**: Given a flag's stored mode and whether the viewer is on its allowlist, the pure function `isEnabled`
  answers: `on` is true for everybody, `allowlist` only for a listed viewer, `off` for nobody (an entry on the list of
  an `off` flag changes nothing). `resolveFlags` gives every declared flag for one viewer: a flag with no stored row, or
  with a mode the code does not know, has its default, and stored keys that are not declared are ignored.
- **AC-4**: The server reads the flags once per request (React `cache`; `flagOn` in `src/lib/feature-flags-server.ts`)
  as the viewer, and pages and actions use the plain boolean. The browser never receives the flag tables, anybody's id
  or a flag that is off for the viewer. `flagOn` awaits `connection()` before it does anything else, so a page that asks for a flag
  renders per request and a build never freezes an answer; nothing may catch what `connection()` raises while a page
  is prerendered, or the defaults would be baked into the page.

### A flag that is off is off

- **AC-5**: While a flag is off for the viewer, the feature's pages answer 404, its server actions return a `disabled`
  result without touching the feature's data (they check the flag themselves, before the session), and its links,
  buttons and text are not rendered: hiding a button alone does not count.
- **AC-6**: Switching a flag takes effect on the next request: no deploy, no restart and no cache to clear.

### Storage and access

- **AC-7**: Two tables hold the state: `feature_flags (key, mode)` (the key is kebab-case, the mode one of the three)
  and `feature_flag_users (key, user_id)`, the allowlists. Both have row level security enabled and no policy, and
  `anon` and `authenticated` have no privilege on them, so neither can read or write them through the public API.
- **AC-8**: The app reads the state with `public.feature_flags_for_me()`, a `security definer` function with an empty
  `search_path` that returns, for each stored flag, its key, its mode and whether the caller (`auth.uid()`; nobody when
  signed out) is on its allowlist: never another user's id. Its execution is granted to `anon` and `authenticated`
  and not to `public`.
- **AC-9**: When the lookup fails (a database error, or a thrown error even while making the client), every flag has its
  default, so a new feature stays off, the page still renders and one `[feature-flags]` line is logged with the error's
  code and message and nothing else (spec 0008's rules).
- **AC-10**: The developer switches a flag in the Supabase dashboard (a row of `feature_flags`, rows of
  `feature_flag_users` for an allowlist), in a migration, or from Telegram (below); there is no admin screen.
- **AC-12**: Deleting an account removes its allowlist entries.
- **AC-13**: Every declared flag has a row in `feature_flags` (a migration inserts it with the flag), so its allowlist
  can be filled.

### Tests

- **AC-11**: End-to-end tests switch a flag in the local database with `setFeatureFlag` (`e2e/helpers.ts`). Flags are
  global, so the tests that switch a declared one are `e2e/feature-flags.spec.ts`, which is its own Playwright
  project (`flags`) that starts after the others have finished, runs its tests one after the other and leaves the
  flag as the other tests expect it (`on`). They check each state of `friends`, for a signed-in user, a listed user and
  a signed-out visitor.

### Switching from Telegram

The owner writes to the feedback bot (spec 0017); Telegram delivers the messages to `POST /api/telegram`, a webhook. The
route is under `/api`, so the proxy and the language routing leave it alone.

- **AC-14**: The route answers only a request that carries the header `X-Telegram-Bot-Api-Secret-Token` equal to the server
  variable `TELEGRAM_WEBHOOK_SECRET` (compared in constant time). Anything else, and every other method, gets an empty 404, so the address reveals
  nothing; without the variable, or without the bot configured (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`), it is a 404 for
  everybody.
- **AC-15**: Only the owner is obeyed: the update's chat id and the sender's id must both equal `TELEGRAM_CHAT_ID`. A message
  from anybody else gets no answer and changes nothing (the bot can be found and written to by anyone).
- **AC-16**: A valid update is answered with 200 at once, whatever the command did, so Telegram does not retry; an update
  id that was already handled is ignored (Telegram can deliver one twice). A body over 16 KB, one that is not JSON and an
  update without a text message are ignored with a 200 too.
- **AC-17**: `/flags` lists every declared flag with its description and its mode (`off`, `allowlist`, `on`; a flag with
  no row shows its default) and, for an allowlist, how many users it holds. Stored keys that are not declared are not listed.
- **AC-18**: `/flag <key> <off|allowlist|on>` sets the mode of a declared flag and answers with the new state. An undeclared
  key, or a mode that does not exist, is refused with the valid ones and nothing changes.
- **AC-19**: `/allow <key> <email>` and `/deny <key> <email>` add or remove one user from a flag's allowlist, found by email
  on the server in any letter case; an email that has no account says so and changes nothing. A user added to a flag that is
  not on an allowlist is stored, and the answer says it has no effect until the flag is. A flag with no row first gets its
  default mode.
- **AC-20**: Switching a flag to `on` (everybody, signed-out visitors included) is not done at once: the bot asks for
  `/confirm`, which does it within 60 seconds. Anything else, including a late `/confirm` and a second one, cancels, and
  is itself carried out as the command it is. Turning a flag `off` or to `allowlist` never asks.
- **AC-21**: Anything else the owner writes, including another command, gets a short help text listing the commands. A bot
  name after the command, as Telegram adds it in a group (`/flag@bot`), is ignored. The texts are English, the owner's own
  tool, and are not part of the three-language rule.
- **AC-22**: A change takes effect on the next request to the site (AC-6), and the answer to the owner is sent after the
  database has accepted it, never before. A refused or failed change answers that nothing was changed; the route never
  throws, and without `SUPABASE_SERVICE_ROLE_KEY` the answer says the commands are not configured.
- **AC-23**: The tables are changed only through `security definer` functions with an empty `search_path`
  (`admin_list_feature_flags`, `admin_set_feature_flag`, `admin_set_feature_flag_user`) that only `service_role` may call;
  the route calls them with the service role key (`SUPABASE_SERVICE_ROLE_KEY`, server-only, used by this route alone). Setting
  a mode or an allowlist entry again changes nothing more, and a mode that does not exist is refused.
- **AC-24**: Each change is logged as one `[feature-flags] change` line: the flag, what was asked (`off`, `allowlist`, `on`,
  `allow`, `deny`) and the result (`ok`, `no_account`, `failed` with the error's code and message), never the email, the
  user id, the bot token, the webhook secret, the service role key or the message text (spec 0008's rules).
- **AC-25**: Commands are rate limited to 30 a minute: the owner can type fast, a leaked secret cannot hammer the
  database. The rest are ignored.
- **AC-26**: `npm run telegram:webhook -- set|info|delete` registers, shows or removes the webhook at Telegram for the
  production address (`SITE_URL`, https) with the secret token and for messages only, and never prints the token or the
  secret. `npm run telegram:check` (spec 0017 AC-9) says whether the webhook is registered.
  `deploy/README.md` documents the two new server variables and the steps, and `.env.example` names them. The test server
  never has either variable (spec 0006 AC-7), so the route is a 404 there.

## Out of scope

An admin screen; anything but flags in the Telegram bot (deploying, logs, database queries), more than one owner or a team
chat, buttons, creating or deleting a flag (they are declared in code); percentage rollouts or A/B experiments; a switch users flip themselves; flags for build-time or
environment settings (those stay environment variables); per-flag analytics; a visible "beta" marker.

## Notes

- Flags today: `friends` (spec 0024; `on` in production, which the migration that adds the tables records). A flag
  is declared together with the feature it hides, never ahead of it.
- `feature_flags_for_me()` returns the mode and a `listed` bit instead of the enabled keys, so the rules of AC-3 live
  in one place that unit tests reach without a database. The mode of a stored flag is not secret.
- A flag that is on for everybody has done its job: delete the flag, its checks and its rows in the pull request that
  makes the feature permanent. The registry should stay short.
- The feature flag tables are not part of the weekly backup (spec 0012 AC-1): migrations seed them and the developer
  sets them.
- The webhook keeps its duplicate memory, its rate limit and a pending `/confirm` in the memory of the one server process:
  a restart forgets them, which only costs a repeated `/confirm`.
- Telegram refuses `getUpdates` while a webhook is registered, so `telegram:check -- --find-chat-id` needs
  `telegram:webhook -- delete` first.
- Telegram's `secret_token` is sent back as `X-Telegram-Bot-Api-Secret-Token` on every update: the standard way to tell
  Telegram's calls from anyone else's. The request URL of the Bot API holds the bot token, so nothing logs a URL, a fetch
  error object or a message text (spec 0017).
- Run only the flags tests with `npx playwright test --project flags --no-deps`.

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2, AC-3, AC-9 | `src/lib/feature-flags.test.ts`, `src/lib/feature-flags-server.test.ts` |
| AC-4 (waiting for a request first, a plain boolean), AC-8 (the call), AC-9 (the log line) | `src/lib/feature-flags-server.test.ts`, `src/lib/log.test.ts`; that it is read once per request is React's `cache`, which does nothing outside a render, so no test can show it |
| AC-5 | `src/app/[locale]/(pages)/friends/actions.test.ts` (`disabled` before anything is touched), `e2e/feature-flags.spec.ts` (the pages, the link and the paragraph, and an action called while the flag turns off) |
| AC-6, AC-11 | `e2e/feature-flags.spec.ts` |
| AC-7, AC-8, AC-12, AC-13 | `tests/feature-flags-database.test.ts` (against the local database, run by CI's end-to-end job) |
| AC-10 | manual (the Supabase dashboard is a web UI): change a row of `feature_flags` there and reload the page. Last checked: never recorded. The Telegram way is AC-14 to AC-26. |
| AC-14, AC-15, AC-16, AC-22, AC-24, AC-25 | `src/app/api/telegram/route.test.ts` (the route with a mocked service client and a mocked `sendTelegramMessage`: secret, owner, duplicates, odd bodies, the order of database and answer, the rate limit, what is logged) |
| AC-14, AC-15, AC-16 | `src/lib/telegram-webhook.test.ts` (the secret comparison, what an update is, who is the owner, the duplicate memory); `src/proxy.test.ts` (the proxy skips `/api/telegram`) |
| AC-17 to AC-22, AC-24 | `src/lib/flag-commands.test.ts` (every command, refusal, the 60 seconds, the help, the order of database and answer, the log lines), `src/lib/log.test.ts` |
| AC-17, AC-23 | `tests/flag-admin-database.test.ts` (against the local database: only `service_role` may call the functions, they are `security definer` with an empty `search_path`, idempotent, email lookup, `no_account`, `no_flag`, `bad_mode`; and the real route with the real database, only the message to Telegram caught: `/flags`, `/allow`, `/deny`, `/flag` and `/confirm`) |
| AC-14, AC-26 | `e2e/telegram-webhook.spec.ts` (on the test server the route is an empty 404, for every method) |
| AC-23 (the key) | `tests/service-role-key.test.ts` (only the webhook route imports the service client) |
| AC-26 | `tests/telegram-webhook-script.test.ts` and `tests/telegram-check.test.ts` (the scripts against a fake Telegram API on localhost; the token and the secret are never printed), `tests/test-server-env.test.ts` (the test server has no secret or key) |
| AC-26 (the real bot) | manual (it needs the real bot and the production site): `npm run telegram:webhook -- set`, then `/flags`, `/flag friends allowlist` and `/flags` again from the phone. Last checked: never recorded. |
