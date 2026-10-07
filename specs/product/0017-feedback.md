# 0017: Feedback form with Telegram notifications

Status: Done
Owner code: `src/app/[locale]/(pages)/feedback/*`, `src/lib/feedback.ts`, `src/lib/stamp-lookup.ts`, `src/lib/telegram.ts`,
`src/lib/rate-limit.ts`, `supabase/migrations/0008_pages_settings.sql`, `scripts/telegram-check.mjs`

## Goal

Visitors and users can tell the developer about a bug or an idea, and the developer actually hears
about it: every message is stored in `user_feedback` (the source of truth) and delivered to the developer's
Telegram, and the form is safe to expose to anyone (it is public, in the footer).

## Why Telegram

Instant, free, works on the phone, and needs no domain or mail setup. Email (Resend or similar) needs a
verified sender domain and DNS records; it can replace `src/lib/telegram.ts` later without touching
the rest.

## Behaviour

- **AC-1**: `/feedback` is public (signed in or not). One textarea with a visible label, a counter, a
  submit button and a note on what is sent. It has its own title like the other pages.
- **AC-2**: A message is trimmed, line endings are normalised, and it must be 1 to 2000 characters.
  The same rule is enforced in the form (`maxLength`, submit disabled when empty), on the server
  (`validateFeedback`) and in the database (`check (char_length(message) between 1 and 2000)`).
- **AC-3**: A valid message is stored in `user_feedback` with the signed-in user's id, or no user id for
  a visitor. The database refuses a `user_id` that isn't the caller's own (RLS), so feedback can't be
  filed in somebody else's name, and nothing can read feedback through the API.
- **AC-4**: After storing, the server sends the message to Telegram (Bot API `sendMessage`, plain text,
  no markup parsing): the text, the language of the page, and the sender (the signed-in user's email,
  `user <id>` for an account without one, or "anonymous"). Sent only when `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set; otherwise the
  message is just stored. Texts over Telegram's 4096-character limit are cut.
- **AC-5**: Telegram is best effort: an error, a non-2xx answer or a 4 s timeout never fails the
  submission (the row is saved) and is logged as one line without the token or the message text.
- **AC-6**: The form tells the sender what is sent along: "if you are signed in, your email is sent
  with the message so I can reply".
- **AC-7**: Abuse limits: a hidden "website" field that humans never fill (a bot that fills it gets a
  success answer and nothing is stored or sent), at most 5 messages per 10 minutes per IP address, and
  at most 100 per hour overall (an in-memory limiter: one server process, resets on restart; the
  database is the real limit).
- **AC-8**: The form shows distinct, translated messages for: sent, too long, rate limited, and a
  generic error; after a success the form clears and can be used again.
- **AC-9**: `npm run telegram:check` verifies the setup from the command line: it loads `.env.local`,
  checks the token with `getMe`, sends a test message, and with `--find-chat-id` lists the chats that
  recently wrote to the bot, so the chat id can be copied. It also says whether the webhook of the flag commands
  (spec 0035) is registered, and where it points.
- **AC-10**: Unexpected input to the server action (not a string, an array, ...) is a clean `invalid`
  result, never a thrown error.
- **AC-11**: The form can be opened for one stamp, `/<language>/feedback?stamp=<code>` (the link of spec 0003 AC-27): the address carries a stamp code and nothing else. The
  code counts only if it has the shape of a stamp code (`OKTPH_...`, one value) **and** is a current stamp of the seed; anything else (free text, an unknown or
  retired code, two values, an empty one) gives the plain form, so no link can put words into a visitor's form. For a known stamp the form says "About the stamp <name> (<code>)",
  the name being the seed's, and sends the code with the message; the server checks it again, and puts a line "Stamp: <name> (<code>)" and an empty line before the
  sender's words, in the stored row and in Telegram, in English whatever the page's language. That line counts in the 2000 characters (the form shows what is left, the
  server refuses a message that is too long with it). An unknown code sent to the action is ignored (the message is stored as written); a seed that cannot be read fails the
  submission. The form's honeypot and rate limit (AC-7) apply as before and come first.

## Out of scope

Replies to the sender; attachments; email delivery; a feedback inbox inside the app (read it in the
Supabase dashboard, table `user_feedback`).

## Notes

- Secrets: `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are server-only environment variables (never
  `NEXT_PUBLIC_`). Locally and on the server they live in `.env.local`; `.env.example` has placeholders.
  Setup: talk to @BotFather (`/newbot`), copy the token, send any message to the new bot, then run
  `npm run telegram:check -- --find-chat-id`.
- The same bot and chat also carry the messages about failed server actions (spec 0008 AC-6 to AC-10).
- The Telegram request URL contains the token, so error handling never logs the URL or the underlying
  error object, only a short reason (`http_401`, `timeout`, `network`).
- The client IP comes from `x-forwarded-for` (set by Caddy in production); without it everyone shares
  one bucket, which is fine for development.
- The about page's "Your data" text is updated: feedback goes to the developer, with the email when
  signed in (spec 0015 AC-5).
- Node's `fetch` keeps sockets alive, and on Windows that crashes a process at exit with a libuv
  assertion (seen in `telegram-check.mjs` and in E2E workers). The script throws instead of calling
  `process.exit()`, and the E2E helpers use Playwright's `request` fixture instead of `fetch`.

## Coverage

| AC | Test |
| --- | --- |
| AC-2, AC-10 | `src/lib/feedback.test.ts`, `src/app/[locale]/(pages)/feedback/actions.test.ts` |
| AC-3 | `actions.test.ts` (what is inserted, for visitor and user); `e2e/feedback.spec.ts` against the real database: a visitor's row has no user id, a signed-in user's row has their id, and as an anonymous API caller a forged `user_id` (RLS), a message over 2000 characters or an empty one (check constraint) are refused, and feedback can't be read back |
| AC-4, AC-5 | `src/lib/telegram.test.ts`, `actions.test.ts` (notification text and target, skipped without config, failures never fail the action, token and message text never logged), `src/lib/log.test.ts` |
| AC-7 | `src/lib/rate-limit.test.ts`, `actions.test.ts` (honeypot, per-address limit) |
| AC-1, AC-6, AC-8 | `e2e/feedback.spec.ts` (footer link, title, send, cleared form, ru/hu labels), `FeedbackForm.test.tsx` (counter, every message, sending state, honeypot wiring, note) |
| AC-11 | `src/lib/feedback.test.ts` (only the shape of a stamp code; the line and the room it takes), `src/app/[locale]/(pages)/feedback/actions.test.ts` (a known code puts the seed's name before the message in the row and in Telegram; free text, an unknown, a retired code, a number and an array are ignored; nothing is looked up for a message without a stamp or from a bot; the line counts in the 2000; an unreadable seed fails), `src/app/[locale]/(pages)/feedback/FeedbackForm.test.tsx` (the line, the room, only the code is sent), `e2e/feedback.spec.ts` (the page, the stored row, and the plain form for six kinds of wrong address) |
| AC-9 | `tests/telegram-check.test.ts` (the script against a fake Telegram API on localhost: a working setup, `--find-chat-id` with and without chats, a bad token, no token, no chat id, an unreachable API; the token is never printed) |
| AC-9 (the real bot) | manual (it needs the real bot and chat): `npm run telegram:check` prints "Test message sent" and the message arrives. Last checked: never recorded. |
