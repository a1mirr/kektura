import { createFailureAlerter, type Failure } from "./failure-alerts";
import { sendTelegramMessage, telegramConfig } from "./telegram";

export type StampAction = "setPlacesStamped" | "setStampDate" | "setStampDates" | "setExtraStamped" | "setExtraStampDate";
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

const safeReason = (reason: string) => (/^[\w-]{1,32}$/.test(reason) ? reason : "unknown");

// Does not wait for Telegram: an action never waits for it, or fails because of it.
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

export function logStampActionInvalidInput(action: StampAction): void {
  console.warn(`${TAG} invalid input action=${action}`);
}

// A refused request is an expected outcome, so it is never sent to Telegram.
export function logStampActionRefused(action: StampAction): void {
  console.warn(`${TAG} request refused action=${action}`);
}

export function logFeedbackError(stage: "write" | "exception", error: unknown, userId?: string): void {
  const { code, message } = describeError(error);
  console.error(
    `[feedback] stage=${stage} user=${userId ?? "anonymous"} code=${code ?? "-"} message=${quote(message)}`,
  );
  alertFailure({ tag: "feedback", action: "submitFeedback", stage, code });
}

export function logFeedbackNotifyFailure(reason: string): void {
  console.warn(`[feedback] telegram notification failed reason=${safeReason(reason)}`);
}

export function logAccountDeletionError(stage: "rpc" | "exception", error: unknown, userId?: string): void {
  const { code, message } = describeError(error);
  console.error(
    `[account-delete] stage=${stage} user=${userId ?? "unknown"} code=${code ?? "-"} message=${quote(message)}`,
  );
  alertFailure({ tag: "account-delete", action: "deleteAccount", stage: stage === "rpc" ? "write" : "exception", code });
}

// `stage` is only for the Telegram message (the line has none).
export function logFriendsError(action: string, error: unknown, stage: Failure["stage"] = "write"): void {
  const { code, message } = describeError(error);
  console.error(`[friends] action=${action} code=${code ?? "-"} message=${quote(message)}`);
  alertFailure({ tag: "friends", action, stage, code });
}

// `stage` is only for the Telegram message, as for the friends actions; a failed `read` is logged and never sent.
export function logShareError(action: string, error: unknown, stage: Failure["stage"] | "read" = "write"): void {
  const { code, message } = describeError(error);
  console.error(`[share] action=${action} code=${code ?? "-"} message=${quote(message)}`);
  if (stage !== "read") alertFailure({ tag: "share", action, stage, code });
}

export function logFeatureFlagsError(error: unknown): void {
  const { code, message } = describeError(error);
  console.error(`[feature-flags] lookup failed code=${code ?? "-"} message=${quote(message)}`);
}

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
