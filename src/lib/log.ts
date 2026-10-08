// Server-side logging for the server actions (spec 0008): the stamp actions, feedback,
// account deletion and friends. They turn every error into a plain `failed` result for the client, so
// this is the only trace a failure leaves. It is the single place to hook an error-monitoring service in later.
//
// One line per event, plain `key=value` text that is easy to grep in the host's logs. Only the action
// name, the stage, the user id and the error's own code/message are logged: never tokens, cookies,
// emails, request input, or the extra `details` / `hint` a Supabase error can carry.
//
// A failure that is not an expected outcome also goes to Telegram (spec 0008 AC-6 to AC-10), through
// `src/lib/failure-alerts.ts`, once per kind of failure and hour.

import { createFailureAlerter, type Failure } from "./failure-alerts";
import { sendTelegramMessage, telegramConfig } from "./telegram";

export type StampAction = "setPlacesStamped" | "setStampDate" | "setStampDates" | "setExtraStamped" | "setExtraStampDate";
// Where it failed: reading the checkpoints, writing the stamps, or something that threw.
export type StampStage = "read" | "write" | "exception";

const TAG = "[stamp-action]";
const MAX_MESSAGE = 300;

// Supabase errors and exceptions both carry a `message`, Postgres/PostgREST errors also a `code`.
// Anything else is replaced by a constant, so an arbitrary thrown value can't smuggle data in.
function describeError(error: unknown): { code?: string; message: string } {
  if (typeof error === "object" && error !== null) {
    const { code, message } = error as { code?: unknown; message?: unknown };
    if (typeof message === "string") {
      return { code: typeof code === "string" && /^[\w.-]{1,32}$/.test(code) ? code : undefined, message };
    }
  }
  return { message: "unknown error" };
}

// Only a reason such as http_401, timeout or network is ever logged for a failed Telegram request: the request URL
// holds the bot token and the message text can hold what the sender wrote.
const safeReason = (reason: string) => (/^[\w-]{1,32}$/.test(reason) ? reason : "unknown");

// Sends the text to the feedback chat (spec 0017) without waiting for it: an action never waits for, or fails
// because of, Telegram (spec 0008 AC-9).
function sendAlert(text: string): void {
  const config = telegramConfig();
  if (!config) return;
  sendTelegramMessage(text, config).then(
    (sent) => {
      if (!sent.ok) console.warn(`[alerts] telegram notification failed reason=${safeReason(sent.reason)}`);
    },
    () => console.warn("[alerts] telegram notification failed reason=unknown"),
  );
}

// One alerter per process, kept on `globalThis`: Next can load this module once per route bundle, and the rate
// limit has to be shared by all of them.
const alerts = globalThis as typeof globalThis & { __kekturaFailureAlerter?: ReturnType<typeof createFailureAlerter> };

// Only a production build sends: on a developer's machine, which may hold the real bot's token, a failure stays in
// the terminal, and the tests send nothing unless they ask for it.
function alertFailure(failure: Failure): void {
  try {
    if (process.env.NODE_ENV !== "production" || !telegramConfig()) return;
    (alerts.__kekturaFailureAlerter ??= createFailureAlerter({ send: sendAlert })).report(failure);
  } catch {
    // Never let the alert change what the action returns.
  }
}

// JSON.stringify quotes the text and escapes newlines, so an event always stays on one line.
const quote = (text: string) => JSON.stringify(text.length > MAX_MESSAGE ? `${text.slice(0, MAX_MESSAGE)}...` : text);

export function logStampActionError(action: StampAction, stage: StampStage, error: unknown, userId?: string): void {
  const { code, message } = describeError(error);
  console.error(
    `${TAG} action=${action} stage=${stage} user=${userId ?? "unknown"} code=${code ?? "-"} message=${quote(message)}`,
  );
  if (stage !== "read") alertFailure({ tag: "stamp-action", action, stage, code });
}

// The rejected input itself is never logged, only that something was rejected.
export function logStampActionInvalidInput(action: StampAction): void {
  console.warn(`${TAG} invalid input action=${action}`);
}

// A request with valid input that the database refused (spec 0016 AC-17: a stamp that is gone, a retired stamp's day): an
// expected outcome, one warning with the action name only. It is no failure of ours, so it is never sent to Telegram (spec 0008 AC-6).
export function logStampActionRefused(action: StampAction): void {
  console.warn(`${TAG} request refused action=${action}`);
}

// Feedback form (spec 0017) and account deletion (spec 0014): same one-line format, their own tags.
export function logFeedbackError(stage: "write" | "exception", error: unknown, userId?: string): void {
  const { code, message } = describeError(error);
  console.error(
    `[feedback] stage=${stage} user=${userId ?? "anonymous"} code=${code ?? "-"} message=${quote(message)}`,
  );
  alertFailure({ tag: "feedback", action: "submitFeedback", stage, code });
}

// Only a short reason such as http_401, timeout or network: the request URL holds the bot token and
// the message text is the sender's, so neither is ever logged.
export function logFeedbackNotifyFailure(reason: string): void {
  console.warn(`[feedback] telegram notification failed reason=${safeReason(reason)}`);
}

export function logAccountDeletionError(stage: "rpc" | "exception", error: unknown, userId?: string): void {
  const { code, message } = describeError(error);
  console.error(
    `[account-delete] stage=${stage} user=${userId ?? "unknown"} code=${code ?? "-"} message=${quote(message)}`,
  );
  // The database function is the write; the message names the stage the way the other actions do.
  alertFailure({ tag: "account-delete", action: "deleteAccount", stage: stage === "rpc" ? "write" : "exception", code });
}

// Friends actions (spec 0024 AC-14): the action name and the error's own code and message, no user ids,
// names or tokens.
// `stage` is only for the Telegram message (the line has none): every friends action is a database write, unless
// something threw around it.
export function logFriendsError(action: string, error: unknown, stage: Failure["stage"] = "write"): void {
  const { code, message } = describeError(error);
  console.error(`[friends] action=${action} code=${code ?? "-"} message=${quote(message)}`);
  alertFailure({ tag: "friends", action, stage, code });
}

// Share cards (spec 0039 AC-13): the action name and the error's own code and message, no user ids, names, tokens or
// numbers of a card. `stage` is only for the Telegram message, as for the friends actions; a failed `read` is logged and
// never sent (spec 0008 AC-6).
export function logShareError(action: string, error: unknown, stage: Failure["stage"] | "read" = "write"): void {
  const { code, message } = describeError(error);
  console.error(`[share] action=${action} code=${code ?? "-"} message=${quote(message)}`);
  if (stage !== "read") alertFailure({ tag: "share", action, stage, code });
}

// Feature flags (spec 0035 AC-9): a failed lookup.
// The error's own code and message, never user ids, emails or the input.
export function logFeatureFlagsError(error: unknown): void {
  const { code, message } = describeError(error);
  console.error(`[feature-flags] lookup failed code=${code ?? "-"} message=${quote(message)}`);
}

// A flag change made from the Telegram bot (spec 0035 AC-24): the flag, what was asked and what happened, one line.
// Never the email, the user id, the message text or the bot token; a failure adds the error's code and message.
export type FlagChange = "off" | "allowlist" | "on" | "allow" | "deny";
export type FlagChangeResult = "ok" | "no_account" | "failed";

export function logFlagChange(key: string, change: FlagChange, result: FlagChangeResult, error?: unknown): void {
  if (result !== "failed") {
    console.info(`[feature-flags] change key=${key} change=${change} result=${result}`);
    return;
  }
  const { code, message } = describeError(error);
  console.error(`[feature-flags] change key=${key} change=${change} result=failed code=${code ?? "-"} message=${quote(message)}`);
}
