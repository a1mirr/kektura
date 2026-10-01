import { afterEach, describe, expect, it, vi } from "vitest";
import { logStampActionError, logStampActionInvalidInput } from "./log";

const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
const warnLog = vi.spyOn(console, "warn").mockImplementation(() => {});
afterEach(() => vi.clearAllMocks());

const lineOf = (spy: typeof errorLog) => {
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy.mock.calls[0]).toHaveLength(1);
  return spy.mock.calls[0][0] as string;
};

describe("spec 0008: log lines", () => {
  it("AC-1: reads code and message from a Supabase-style error and the user id", () => {
    logStampActionError("setExtraStamped", "write", { code: "23503", message: "fk violation" }, "u-1");
    expect(lineOf(errorLog)).toBe('[stamp-action] action=setExtraStamped stage=write user=u-1 code=23503 message="fk violation"');
  });

  it("AC-1: an exception has no code, and a missing user is `unknown`", () => {
    logStampActionError("setPlacesStamped", "exception", new TypeError("boom"));
    expect(lineOf(errorLog)).toBe('[stamp-action] action=setPlacesStamped stage=exception user=unknown code=- message="boom"');
  });

  it("AC-1: stays on one line and is capped, however the message looks", () => {
    logStampActionError("setPlacesStamped", "write", new Error(`first\nsecond\r\n${"x".repeat(1000)}`), "u-1");
    const line = lineOf(errorLog);
    expect(line).not.toMatch(/[\r\n]/);
    expect(line.length).toBeLessThan(400);
  });

  it.each([["a string", "secret-token"], ["null", null], ["a number", 42], ["an object without a message", { token: "secret-token" }]])(
    "AC-2: %s thrown is replaced by a constant, never stringified",
    (_, thrown) => {
      logStampActionError("setPlacesStamped", "exception", thrown, "u-1");
      expect(lineOf(errorLog)).toBe('[stamp-action] action=setPlacesStamped stage=exception user=u-1 code=- message="unknown error"');
    },
  );

  it("AC-2: only a short identifier-like `code` is kept", () => {
    logStampActionError("setPlacesStamped", "read", { code: 'x" token=secret', message: "boom" }, "u-1");
    expect(lineOf(errorLog)).toContain("code=- message=");
    expect(lineOf(errorLog)).not.toContain("secret");
  });

  it("AC-3: invalid input is a warning with the action name only", () => {
    logStampActionInvalidInput("setExtraStamped");
    expect(lineOf(warnLog)).toBe("[stamp-action] invalid input action=setExtraStamped");
    expect(errorLog).not.toHaveBeenCalled();
  });
});
