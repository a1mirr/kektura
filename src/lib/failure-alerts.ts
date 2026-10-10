export const ALERT_STAGES = ["write", "exception"] as const;
export type AlertStage = (typeof ALERT_STAGES)[number];

export type Failure = {
  tag: "stamp-action" | "feedback" | "account-delete" | "friends" | "share";
  action: string;
  stage: AlertStage;
  code?: string;
};

export const ALERT_WINDOW_MS = 60 * 60_000;
export const BURST_KINDS = 3;
export const BURST_WINDOW_MS = 60_000;

const LOOK_AT_THE_LOG = "Details: the server log (pm2 logs kektura).";

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
  send: (text: string) => void;
  now?: () => number;
}) {
  const lastSent = new Map<string, number>();
  const recent = new Map<string, number>();
  let quietUntil = 0;

  return {
    report(failure: Failure): void {
      try {
        if (!ALERT_STAGES.includes(failure.stage)) return;
        const at = now();
        const kind = failureKind(failure);

        for (const [k, t] of recent) if (at - t >= BURST_WINDOW_MS) recent.delete(k);
        recent.set(kind, at);
        for (const [k, t] of lastSent) if (at - t >= ALERT_WINDOW_MS) lastSent.delete(k);

        if (at < quietUntil) return;

        // Before the hourly limit: a kind that was already sent still counts as one of the three, and its failure
        // may be the one that shows the outage.
        if (recent.size >= BURST_KINDS) {
          send(formatOutageAlert(recent.size));
          quietUntil = at + ALERT_WINDOW_MS;
          for (const k of recent.keys()) lastSent.set(k, at);
          return;
        }
        if (lastSent.has(kind)) return;
        lastSent.set(kind, at);
        send(formatFailureAlert(failure));
      } catch {
        // Deliberately silent: logging here could loop back into the logger.
      }
    },
  };
}
