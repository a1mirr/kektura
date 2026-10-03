# 0017: Feedback form with Telegram notifications

Status: Done
Owner code: `src/app/[locale]/(pages)/feedback/*`, `src/lib/feedback.ts`, `src/lib/telegram.ts`,
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
  or "anonymous"). Sent only when `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set; otherwise the
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
  recently wrote to the bot, so the chat id can be copied.
- **AC-10**: Unexpected input to the server action (not a string, an array, ...) is a clean `invalid`
  result, never a thrown error.

## Out of scope

Replies to the sender; attachments; email delivery; a feedback inbox inside the app (read it in the
Supabase dashboard, table `user_feedback`).

## Notes

- Secrets: `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are server-only environment variables (never
  `NEXT_PUBLIC_`). Locally and on the server they live in `.env.local`; `.env.example` has placeholders.
  Setup: talk to @BotFather (`/newbot`), copy the token, send any message to the new bot, then run
  `npm run telegram:check -- --find-chat-id`.
- The Telegram request URL contains the token, so error handling never logs the URL or the underlying
  error object, only a short reason (`http_401`, `timeout`, `network`).
- The client IP comes from `x-forwarded-for` (set by Caddy in production); without it everyone shares
  one bucket, which is fine for development.
- The about page's "Your data" text is updated: feedback goes to the developer, with the email when
  signed in (spec 0015 AC-5).
- Node's `fetch` keeps sockets alive, and on Windows that crashes a process at exit with a libuv
  assertion (seen in `telegram-check.mjs` and in E2E workers). The script throws instead of calling
  `process.exit()`, and the E2E helpers use Playwright's `request` fixture instead of `fetch`.
- Migration `0008` was rewritten in place: it had not been applied anywhere but the local test database
  (production had neither 0007 nor 0008 when this was written).

## Coverage

| AC | Test |
| --- | --- |
| AC-2, AC-10 | `src/lib/feedback.test.ts`, `src/app/[locale]/(pages)/feedback/actions.test.ts` |
| AC-3 | `actions.test.ts` (what is inserted, for visitor and user); `e2e/feedback.spec.ts` against the real database: a visitor's row has no user id, a signed-in user's row has their id, and as an anonymous API caller a forged `user_id` (RLS), a message over 2000 characters or an empty one (check constraint) are refused, and feedback can't be read back |
| AC-4, AC-5 | `src/lib/telegram.test.ts`, `actions.test.ts` (notification text and target, skipped without config, failures never fail the action, token and message text never logged), `src/lib/log.test.ts` |
| AC-7 | `src/lib/rate-limit.test.ts`, `actions.test.ts` (honeypot, per-address limit) |
| AC-1, AC-6, AC-8 | `e2e/feedback.spec.ts` (footer link, title, send, cleared form, ru/hu labels), `FeedbackForm.test.tsx` (counter, every message, sending state, honeypot wiring, note) |
| AC-9 | `npm run telegram:check` exercised against a fake Telegram API on localhost in 7 situations (works, find chat id, bad token, no chats yet, no token, no chat id, unreachable): correct output and exit codes, token never printed. Not run against the real Telegram: that needs your bot |
