// Telegram messages for failed server actions (spec 0008 AC-6 to AC-10). `src/lib/log.ts` reports every failure of
// the actions here after it has written its log line; this file decides whether the owner hears about it and what the
// message says. Pure: the clock and the sending are injected, so the rules are tested without a network.
//
// What may go into a message: the tag, the action, the stage and the error's own short `code`. Never the error
// message (it can quote row values), emails, user ids, request input or Supabase `details` / `hint`: the server
// log has the rest, the message only says where to look.

// Only these stages are sent: the expected outcomes (no session, rejected input) are not failures, and a failed
// read is left to the log.
export const ALERT_STAGES = ["write", "exception"] as const;
export type AlertStage = (typeof ALERT_STAGES)[number];

export type Failure = {
  tag: "stamp-action" | "feedback" | "account-delete" | "friends";
  action: string;
  stage: AlertStage;
  // A short identifier such as `42501`; anything else is dropped before it gets here.
  code?: string;
};

// One message per kind of failure in this long (AC-7).
export const ALERT_WINDOW_MS = 60 * 60_000;
// When this many different kinds fail within `BURST_WINDOW_MS`, the cause is shared (the database is down): one
// summary is sent and single messages are paused for `ALERT_WINDOW_MS` (AC-8).
export const BURST_KINDS = 3;
export const BURST_WINDOW_MS = 60_000;

const LOOK_AT_THE_LOG = "Details: the server log (pm2 logs kektura).";

// A kind of failure is the tag, the action and the stage.
export const failureKind = ({ tag, action, stage }: Failure) => `[${tag}] ${action} ${stage}`;

export function formatFailureAlert(failure: Failure): string {
  const code = failure.code ? `, code ${failure.code}` : "";
  return [
    "Kektura: a server action failed.",
    `${failureKind(failure)}${code}`,
    `No more messages for this kind for an hour. ${LOOK_AT_THE_LOG}`,
  ].join("\n");
}

export function formatOutageAlert(kinds: number): string {
  return [
    `Kektura: ${kinds} kinds of server action failures within a minute. Possibly the database is down.`,
    `No more messages for an hour. ${LOOK_AT_THE_LOG}`,
  ].join("\n");
}

export function createFailureAlerter({
  send,
  now = Date.now,
}: {
  // Fire and forget: what it does can never reach the caller.
  send: (text: string) => void;
  now?: () => number;
}) {
  const lastSent = new Map<string, number>();
  const recent = new Map<string, number>(); // kind -> when it last failed, within the burst window
  let quietUntil = 0;

  return {
    // Never throws: a failing `send` must not change what a server action returns (AC-9).
    report(failure: Failure): void {
      try {
        if (!ALERT_STAGES.includes(failure.stage)) return;
        const at = now();
        const kind = failureKind(failure);

        for (const [k, t] of recent) if (at - t >= BURST_WINDOW_MS) recent.delete(k);
        recent.set(kind, at);
        for (const [k, t] of lastSent) if (at - t >= ALERT_WINDOW_MS) lastSent.delete(k);

        if (at < quietUntil) return;
        if (lastSent.has(kind)) return;

        if (recent.size >= BURST_KINDS) {
          send(formatOutageAlert(recent.size));
          quietUntil = at + ALERT_WINDOW_MS;
          for (const k of recent.keys()) lastSent.set(k, at);
          return;
        }
        lastSent.set(kind, at);
        send(formatFailureAlert(failure));
      } catch {
        // Deliberately silent: logging here could loop back into the logger.
      }
    },
  };
}
