// Server-side logging for the stamp actions (specs/0008-action-logging.md). The actions turn every
// error into `{ ok: false, reason: "failed" }` for the client, so this is the only trace a failure
// leaves. It is the single place to hook an error-monitoring service in later.
//
// One line per event, plain `key=value` text that is easy to grep in the host's logs. Only the action
// name, the stage, the user id and the error's own code/message are logged: never tokens, cookies,
// emails, request input, or the extra `details` / `hint` a Supabase error can carry.

export type StampAction = "setPlacesStamped" | "setExtraStamped";
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

// JSON.stringify quotes the text and escapes newlines, so an event always stays on one line.
const quote = (text: string) => JSON.stringify(text.length > MAX_MESSAGE ? `${text.slice(0, MAX_MESSAGE)}...` : text);

export function logStampActionError(action: StampAction, stage: StampStage, error: unknown, userId?: string): void {
  const { code, message } = describeError(error);
  console.error(
    `${TAG} action=${action} stage=${stage} user=${userId ?? "unknown"} code=${code ?? "-"} message=${quote(message)}`,
  );
}

// The rejected input itself is never logged, only that something was rejected.
export function logStampActionInvalidInput(action: StampAction): void {
  console.warn(`${TAG} invalid input action=${action}`);
}
