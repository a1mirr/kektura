import { afterEach, describe, expect, it, vi } from "vitest";
import {
  logAccountDeletionError,
  logFeedbackError,
  logFeatureFlagsError,
  logFlagChange,
  logFeedbackNotifyFailure,
  logFriendsError,
  logStampActionError,
  logStampActionInvalidInput,
  logStampActionRefused,
} from "./log";

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

  it("AC-3: a refused request is a warning of its own, with the action name only", () => {
    logStampActionRefused("setStampDates");
    expect(lineOf(warnLog)).toBe("[stamp-action] request refused action=setStampDates");
    expect(errorLog).not.toHaveBeenCalled();
  });
});

describe("spec 0008: the other actions' lines", () => {
  it("AC-5: feedback, account-delete and friends lines each keep to one line, their tag, and the code and message only", () => {
    const error = { code: "42501", message: "line one\nline two", details: "secret-details", hint: "secret-hint" };
    logFeedbackError("write", error, "u-1");
    logAccountDeletionError("rpc", error, "u-1");
    logFriendsError("sendRequest", error);
    const lines = errorLog.mock.calls.map((call) => call[0] as string);
    expect(lines.map((line) => line.split(" ")[0])).toEqual(["[feedback]", "[account-delete]", "[friends]"]);
    expect(lines[2]).not.toContain("u-1"); // the friends line carries no user id
    for (const line of lines) {
      expect(line).not.toContain("\n");
      expect(line).toContain('message="line one\\nline two"');
      expect(line).not.toMatch(/secret/);
    }
  });
});

describe("spec 0017: feedback and account-deletion log lines", () => {
  it("AC-5: a feedback failure is one line with stage, user (or anonymous), code and message", () => {
    logFeedbackError("write", { code: "42501", message: "denied", details: "secret-details" }, "u-1");
    expect(lineOf(errorLog)).toBe('[feedback] stage=write user=u-1 code=42501 message="denied"');
    logFeedbackError("exception", new Error("boom"));
    expect(errorLog.mock.calls[1][0]).toBe('[feedback] stage=exception user=anonymous code=- message="boom"');
  });

  it("AC-5: a failed Telegram notification logs only a short reason", () => {
    logFeedbackNotifyFailure("http_401");
    expect(warnLog.mock.calls).toEqual([["[feedback] telegram notification failed reason=http_401"]]);
  });

  it("AC-5: a reason that could carry data (a URL with the bot token) is replaced", () => {
    logFeedbackNotifyFailure("https://api.telegram.org/bot123:SECRET/sendMessage failed");
    expect(warnLog.mock.calls).toEqual([["[feedback] telegram notification failed reason=unknown"]]);
  });

  it("spec 0014: an account deletion failure is one line with stage, user, code and message", () => {
    logAccountDeletionError("rpc", { code: "P0001", message: "Not authenticated" }, "u-2");
    expect(lineOf(errorLog)).toBe('[account-delete] stage=rpc user=u-2 code=P0001 message="Not authenticated"');
  });
});

describe("spec 0035: feature flag log line", () => {
  it("AC-9: one line with the code and message, nothing else", () => {
    logFeatureFlagsError({ code: "57014", message: "timeout", details: "secret", hint: "secret" });
    expect(lineOf(errorLog)).toBe('[feature-flags] lookup failed code=57014 message="timeout"');
  });
});

describe("spec 0035: flag change log lines", () => {
  it("AC-24: a change is one info line, a failure one error line with the error code and message", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    logFlagChange("friends", "on", "ok");
    expect(info).toHaveBeenCalledWith("[feature-flags] change key=friends change=on result=ok");
    logFlagChange("friends", "allow", "no_account");
    expect(info).toHaveBeenLastCalledWith("[feature-flags] change key=friends change=allow result=no_account");
    logFlagChange("friends", "off", "failed", { code: "42501", message: "denied", details: "secret" });
    expect(lineOf(errorLog)).toBe('[feature-flags] change key=friends change=off result=failed code=42501 message="denied"');
    info.mockRestore();
  });
});

describe("spec 0008: failures reach Telegram", () => {
  const fetchMock = vi.fn();
  const alerts = globalThis as { __kekturaFailureAlerter?: unknown };
  const enable = () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:SECRET");
    vi.stubEnv("TELEGRAM_CHAT_ID", "42");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
  };
  const sentTexts = () => fetchMock.mock.calls.map((call) => JSON.parse(String((call[1] as RequestInit).body)).text as string);
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  afterEach(() => {
    delete alerts.__kekturaFailureAlerter; // the rate limit lives on globalThis
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("AC-6: a stamp write failure and an exception are sent to the feedback chat, with the code only", async () => {
    enable();
    const error = { code: "42501", message: "key (email)=(hiker@example.com) denied", details: "secret-details", hint: "secret-hint" };
    logStampActionError("setPlacesStamped", "write", error, "user-secret-id");
    logStampActionError("setStampDate", "exception", new Error("boom"), "user-secret-id");
    await flush();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bot123:SECRET/sendMessage");
    expect(JSON.parse(String(init.body)).chat_id).toBe("42");
    const texts = sentTexts();
    expect(texts).toHaveLength(2);
    expect(texts[0]).toContain("[stamp-action] setPlacesStamped write, code 42501");
    expect(texts[1]).toContain("[stamp-action] setStampDate exception");
    expect(texts.join("\n")).not.toMatch(/hiker@example|secret|boom|denied/);
  });

  it("AC-6: feedback, account deletion and friends failures are sent under their own tags", async () => {
    enable();
    logFeedbackError("write", { code: "42501", message: "denied" });
    logAccountDeletionError("rpc", { message: "x" }, "u-1");
    await flush();
    expect(sentTexts().map((t) => t.split("\n")[1])).toEqual([
      "[feedback] submitFeedback write, code 42501",
      "[account-delete] deleteAccount write",
    ]);
  });

  it("AC-6: a friends action is a write, or an exception when something threw", async () => {
    enable();
    logFriendsError("sendRequest", { message: "x" });
    logFriendsError("setSharing", { message: "x" }, "exception");
    await flush();
    expect(sentTexts().map((t) => t.split("\n")[1])).toEqual(["[friends] sendRequest write", "[friends] setSharing exception"]);
  });

  it("AC-6: a failed read, rejected input, a flag lookup and a failed notification are not sent", async () => {
    enable();
    logStampActionError("setPlacesStamped", "read", { message: "x" }, "u-1");
    logStampActionInvalidInput("setPlacesStamped");
    logStampActionRefused("setStampDates");
    logFeatureFlagsError({ message: "x" });
    logFeedbackNotifyFailure("http_500");
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AC-7: the same kind is sent once, however often it fails", async () => {
    enable();
    for (let i = 0; i < 5; i++) logStampActionError("setPlacesStamped", "write", { message: "x" }, "u-1");
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("AC-8: three kinds failing at once give one summary message", async () => {
    enable();
    logStampActionError("setPlacesStamped", "write", { message: "x" }, "u-1");
    logFeedbackError("write", { message: "x" });
    logFriendsError("sendRequest", { message: "x" });
    logAccountDeletionError("rpc", { message: "x" }, "u-1");
    logFriendsError("setSharing", { message: "x" });
    await flush();
    const texts = sentTexts();
    expect(texts).toHaveLength(3);
    expect(texts[2]).toContain("3 kinds of server action failures within a minute");
  });

  it("AC-9: the action never waits for Telegram: a hanging request returns at once", async () => {
    enable();
    fetchMock.mockReturnValue(new Promise(() => {}));
    expect(() => logStampActionError("setPlacesStamped", "write", { message: "x" }, "u-1")).not.toThrow();
    expect(errorLog).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["an HTTP error", () => fetchMock.mockResolvedValue(new Response("{}", { status: 502 })), "http_502"],
    ["a network error", () => fetchMock.mockRejectedValue(new TypeError("fetch failed https://api.telegram.org/bot123:SECRET/x")), "network"],
  ])("AC-9: %s only logs a short reason, never the token", async (_, arrange, reason) => {
    enable();
    arrange();
    expect(() => logFriendsError("sendRequest", { message: "x" })).not.toThrow();
    await flush();
    expect(warnLog.mock.calls).toEqual([[`[alerts] telegram notification failed reason=${reason}`]]);
    expect(JSON.stringify([...errorLog.mock.calls, ...warnLog.mock.calls])).not.toContain("SECRET");
  });

  it("AC-9: a fetch that throws synchronously never reaches the action", () => {
    enable();
    fetchMock.mockImplementation(() => {
      throw new Error("sync boom");
    });
    expect(() => logStampActionError("setPlacesStamped", "write", { message: "x" }, "u-1")).not.toThrow();
  });

  it("AC-10: without the bot's token and chat id, or outside a production build, nothing is sent", async () => {
    enable();
    vi.stubEnv("TELEGRAM_CHAT_ID", "");
    logStampActionError("setPlacesStamped", "write", { message: "x" }, "u-1");
    vi.stubEnv("TELEGRAM_CHAT_ID", "42");
    vi.stubEnv("NODE_ENV", "development");
    logStampActionError("setStampDate", "write", { message: "x" }, "u-1");
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    // ...and those two did not use up the budget of their kinds.
    vi.stubEnv("NODE_ENV", "production");
    logStampActionError("setPlacesStamped", "write", { message: "x" }, "u-1");
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
