# 0027: Switching feature flags from the Telegram bot

Status: Draft
Owner code: `src/app/api/telegram/route.ts`, `src/lib/flag-commands.ts`, `scripts/telegram-webhook.mjs`,
`supabase/migrations/0027_flag_admin.sql`

## Goal

Spec 0023 lets a feature be merged dark and switched on later, but changing a flag means opening the
Supabase dashboard and editing rows (0023 AC-9). The owner already has a Telegram bot that tells them about
feedback (spec 0017). Let the owner send it a message to look at the flags and change them: turn friends on
for themselves from the phone, add a tester, switch a feature off when it misbehaves, with no laptop and no
deploy. Builds on 0023, which must exist first.

## Behaviour

### Reaching the app

- **AC-1**: Telegram delivers the owner's messages to `POST /api/telegram` (a webhook). The route answers only
  requests that carry the header `X-Telegram-Bot-Api-Secret-Token` equal to the server variable
  `TELEGRAM_WEBHOOK_SECRET` (compared in constant time); anything else gets an empty 404, so the address
  reveals nothing. Without the variable the route is 404 for everybody.
- **AC-2**: Only messages from the owner are obeyed: the update's chat id **and** sender id must equal the
  configured `TELEGRAM_CHAT_ID`. Anyone else (the bot can be found and written to by anyone) gets no answer
  and changes nothing.
- **AC-3**: The route answers a valid update with 200 at once, whatever the command did, so Telegram does not
  retry; an update id that was already handled is ignored (Telegram can deliver the same one twice).
  A body over 16 KB, a non-JSON body or an update without a text message is ignored.

### Commands

- **AC-4**: `/flags` lists every flag of the registry (0023 AC-1) with its description, its mode (`off`,
  `allowlist`, `on`) and, for an allowlist, how many users it holds.
- **AC-5**: `/flag <key> <off|allowlist|on>` sets the mode of a declared flag and answers with the new state. An
  undeclared key or a mode that does not exist is refused with the list of valid ones; nothing changes.
- **AC-6**: `/allow <key> <email>` and `/deny <key> <email>` add or remove one user from a flag's allowlist. The
  email is looked up on the server; an email that has no account says so. A user added to an `off` flag is
  stored, and the answer says the flag is still off.
- **AC-7**: Switching a flag to `on` (everybody, signed-out visitors included) is not done at once: the bot asks
  to confirm with one reply (`/confirm`) within 60 seconds, and a flag can be turned `off` without asking.
  Anything else cancels it.
- **AC-8**: Anything else the owner writes gets a short help text listing the commands. The texts are English
  (the owner's own tool), and are not part of the three-language rule.

### Effect and safety

- **AC-9**: A change takes effect on the next request to the site (0023 AC-6), and the answer to the owner is
  sent after the database has accepted it, never before.
- **AC-10**: The database is changed only through a `security definer` function granted to the service role (0023
  AC-7 keeps the flag tables closed to the public API); the route calls it with the server-only key. Setting a
  mode or an allowlist entry is idempotent.
- **AC-11**: Each change is logged as one `[feature-flags]` line: the key, the new mode and what happened, never
  the email, the user id, the bot token or the message text (spec 0008's rules). A failed change tells the
  owner "failed" and logs the reason; the route itself never throws.
- **AC-12**: Commands are rate limited (30 per minute): the owner can type fast, a leaked secret cannot hammer
  the database.

### Setting it up

- **AC-13**: `npm run telegram:webhook -- set|info|delete` registers, shows or removes the webhook at Telegram
  for the production address (`SITE_URL`) with the secret token, and prints only whether it worked, never the
  token or the secret. `deploy/README.md` documents the new variables (`TELEGRAM_WEBHOOK_SECRET`, the service
  role key) and `npm run telegram:check` (spec 0017) reports whether the webhook is registered.

## Out of scope

Anything but flags (deploying, restarting, reading logs, database queries); more than one owner or a team
chat; free-text or button menus beyond the one confirmation; creating or deleting a flag (they are declared in
code, 0023 AC-1); a web admin page (0023 leaves it out too); percentage rollouts.

## Open questions

- **Service role key.** The webhook has no signed-in user, so it needs a privileged way into the database: the
  Supabase service role key as a new server secret (recommended: used by this one route only), or a function
  that checks a long shared secret passed as an argument (no new key, but the secret then travels in a query).
  Which one?
- **Who is on an allowlist.** By email as typed above (the bot answers "no such account"), or by user id? Email
  is easier on a phone; it is looked up and never stored or logged.
- **Webhook or polling.** A webhook needs the public HTTPS address (production only, which is enough); long
  polling needs a process that stays up on a 1 GB droplet. Webhook is assumed here.
- **Same bot or another.** Reuse the feedback bot and chat (assumed), or a second bot only for admin, so a
  leaked feedback chat is not also the control channel? The checks of AC-2 hold either way.
- **History.** Is the log line enough, or should changes be kept in a table (who/when/old/new) that can be
  looked at later?
- **Other settings.** Should the same channel later switch other things on and off (maintenance banner)? This
  spec says no; the command parser would not make it hard.

## Notes

- 0023 stays the owner of the flags themselves (registry, resolution, tables); this spec only adds a second way
  to write them, so 0023's AC-9 ("changed in the Supabase dashboard or through a migration") gains a sentence
  when this is implemented.
- Telegram's `secretToken` for `setWebhook` is sent back as `X-Telegram-Bot-Api-Secret-Token` on every update;
  it is the standard way to tell Telegram's calls from anyone else's.
- The route is under `/api/`, outside the locale routing: `src/proxy.ts` must let it through (its matcher
  guards a TS-string escape, `src/proxy.test.ts`).
- Spec 0017's rule stays: the token is in the request URL, so no URL, fetch error object or message text is
  ever logged.

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2, AC-3, AC-12 | planned: `src/app/api/telegram/route.test.ts` (secret, owner, duplicate update, limits) |
| AC-4 to AC-8 | planned: `src/lib/flag-commands.test.ts` (parsing, replies, the confirmation window) |
| AC-9, AC-10 | planned: `tests/flag-admin-migration.test.ts` (the function, who may call it) and `e2e/feature-flags.spec.ts` (a change takes effect on the next request) |
| AC-11 | planned: `src/lib/log.test.ts` |
| AC-13 | manual: set the webhook on production and send `/flags` from the phone; `scripts/telegram-webhook.mjs` unit-tested with a mocked fetch |
