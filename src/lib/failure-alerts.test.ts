import { describe, expect, it, vi } from "vitest";
import {
  ALERT_WINDOW_MS,
  BURST_WINDOW_MS,
  createFailureAlerter,
  failureKind,
  formatFailureAlert,
  formatOutageAlert,
  type Failure,
} from "./failure-alerts";

const stamp: Failure = { tag: "stamp-action", action: "setPlacesStamped", stage: "write", code: "42501" };
const setup = () => {
  let time = 1_000_000;
  const send = vi.fn();
  const alerter = createFailureAlerter({ send, now: () => time });
  return { send, report: alerter.report, advance: (ms: number) => (time += ms) };
};

describe("spec 0008: Telegram messages for failed actions", () => {
  it("AC-6: a kind of failure is the tag, the action and the stage", () => {
    expect(failureKind(stamp)).toBe("[stamp-action] setPlacesStamped write");
    expect(failureKind({ ...stamp, stage: "exception" })).toBe("[stamp-action] setPlacesStamped exception");
  });

  it("AC-6: a write failure and an exception are each sent", () => {
    const { send, report } = setup();
    report(stamp);
    report({ ...stamp, action: "setStampDate", stage: "exception" });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("AC-6: a failed read and anything else outside the sent stages is not", () => {
    const { send, report } = setup();
    report({ ...stamp, stage: "read" as never });
    report({ ...stamp, stage: "unauthorized" as never });
    expect(send).not.toHaveBeenCalled();
  });

  it("AC-7: the same kind is sent once an hour, a different kind has its own budget", () => {
    const { send, report, advance } = setup();
    report(stamp);
    report(stamp);
    advance(ALERT_WINDOW_MS - 1);
    report(stamp);
    expect(send).toHaveBeenCalledTimes(1);
    report({ ...stamp, action: "setExtraStamped" });
    expect(send).toHaveBeenCalledTimes(2);
    advance(1);
    report(stamp);
    expect(send).toHaveBeenCalledTimes(3);
    expect(send).toHaveBeenLastCalledWith(formatFailureAlert(stamp));
  });

  it("AC-8: three kinds within a minute give one summary, then single messages are paused for an hour", () => {
    const { send, report, advance } = setup();
    report(stamp);
    advance(5_000);
    report({ ...stamp, action: "setExtraStamped" });
    advance(5_000);
    report({ tag: "friends", action: "sendRequest", stage: "write" });
    expect(send).toHaveBeenCalledTimes(3);
    expect(send).toHaveBeenLastCalledWith(formatOutageAlert(3));

    advance(1_000);
    report({ tag: "feedback", action: "submitFeedback", stage: "write" });
    report({ tag: "account-delete", action: "deleteAccount", stage: "exception" });
    report(stamp);
    advance(ALERT_WINDOW_MS - 12_000);
    report({ tag: "feedback", action: "submitFeedback", stage: "exception" });
    expect(send).toHaveBeenCalledTimes(3);

    advance(12_000);
    report({ tag: "feedback", action: "submitFeedback", stage: "exception" });
    expect(send).toHaveBeenCalledTimes(4);
    expect(send).toHaveBeenLastCalledWith(formatFailureAlert({ tag: "feedback", action: "submitFeedback", stage: "exception" }));
  });

  it("AC-8: kinds that fail more than a minute apart are not an outage", () => {
    const { send, report, advance } = setup();
    report(stamp);
    advance(BURST_WINDOW_MS);
    report({ ...stamp, action: "setExtraStamped" });
    advance(BURST_WINDOW_MS);
    report({ tag: "friends", action: "sendRequest", stage: "write" });
    expect(send).toHaveBeenCalledTimes(3);
    expect(send).not.toHaveBeenCalledWith(formatOutageAlert(3));
  });

  it("AC-8: a kind that was already rate limited still counts towards an outage", () => {
    const { send, report, advance } = setup();
    report(stamp);
    advance(1_000);
    report(stamp);
    report({ ...stamp, action: "setExtraStamped" });
    expect(send).toHaveBeenCalledTimes(2);
    report({ tag: "friends", action: "sendRequest", stage: "write" });
    expect(send).toHaveBeenLastCalledWith(formatOutageAlert(3));
  });

  it("AC-8: the summary is sent even when the third kind of the outage was already limited", () => {
    const { send, report, advance } = setup();
    const a = stamp;
    const b = { ...stamp, action: "setExtraStamped" };
    report(a);
    report(b);
    advance(5 * 60_000); // still inside the hour of both, but no longer inside one burst
    report({ tag: "friends", action: "sendRequest", stage: "write" });
    report(a);
    report(b);
    expect(send).toHaveBeenCalledTimes(4);
    expect(send).toHaveBeenLastCalledWith(formatOutageAlert(3));
    report({ tag: "feedback", action: "submitFeedback", stage: "write" });
    expect(send).toHaveBeenCalledTimes(4);
  });

  it("AC-9: a `send` that throws never reaches the caller", () => {
    const send = vi.fn(() => {
      throw new Error("boom");
    });
    const { report } = createFailureAlerter({ send });
    expect(() => report(stamp)).not.toThrow();
  });

  it("AC-10: the message names the kind and the error code, and nothing else", () => {
    const text = formatFailureAlert(stamp);
    expect(text).toContain("[stamp-action] setPlacesStamped write, code 42501");
    expect(text).toContain("pm2 logs kektura");
    expect(formatFailureAlert({ ...stamp, code: undefined })).toContain("setPlacesStamped write\n");
    // Whatever else a caller might know (the error message, user ids, input) has no place in a Failure.
    const secret = { ...stamp, message: "key (email)=(a@b.c)", userId: "u-1", details: "secret" } as Failure;
    expect(formatFailureAlert(secret)).not.toMatch(/a@b\.c|u-1|secret/);
  });
});
