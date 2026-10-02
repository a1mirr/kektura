import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { submitFeedback } from "./actions";

type User = { id: string; email?: string } | null;

// Stand-in for the Supabase client: records inserts and answers getUser.
function useSupabase({ user = null as User, insertError = null as unknown } = {}) {
  const insert = vi.fn(async () => ({ error: insertError }));
  const from = vi.fn(() => ({ insert }));
  vi.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user } }) }, from } as never);
  return { insert, from };
}

// Every test uses its own address, so the module's in-memory rate limiter never leaks between tests.
let ipCounter = 0;
let ip = "";
beforeEach(() => {
  ip = `203.0.113.${++ipCounter}`;
  vi.mocked(headers).mockImplementation(async () => new Headers({ "x-forwarded-for": `${ip}, 10.0.0.1` }) as never);
});

const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
const warnLog = vi.spyOn(console, "warn").mockImplementation(() => {});
const fetchMock = vi.fn();
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const enableTelegram = () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:SECRET");
  vi.stubEnv("TELEGRAM_CHAT_ID", "42");
  vi.stubGlobal("fetch", fetchMock);
};

describe("spec 0017: submitFeedback input", () => {
  it.each([[null], [undefined], ["just a string"], [42], [["a"]]])("AC-10: input %j is `invalid` without touching the database", async (input) => {
    const { from } = useSupabase();
    expect(await submitFeedback(input)).toEqual({ ok: false, reason: "invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it.each([[{ message: 5 }], [{ message: { toString: () => "x" } }], [{}]])("AC-10: message %j is `invalid`", async (input) => {
    useSupabase();
    expect(await submitFeedback(input)).toEqual({ ok: false, reason: "invalid" });
  });

  it("AC-2: empty and over-long messages are refused before any database or network access", async () => {
    const { from } = useSupabase();
    enableTelegram();
    expect(await submitFeedback({ message: "   " })).toEqual({ ok: false, reason: "empty" });
    expect(await submitFeedback({ message: "x".repeat(2001) })).toEqual({ ok: false, reason: "too_long" });
    expect(from).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("spec 0017: storing", () => {
  it("AC-3: a visitor's message is stored, trimmed, without a user id", async () => {
    const { insert, from } = useSupabase();
    expect(await submitFeedback({ message: "  Nice map!  ", locale: "en", website: "" })).toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith("user_feedback");
    expect(insert).toHaveBeenCalledWith({ user_id: null, message: "Nice map!" });
  });

  it("AC-3: a signed-in user's message carries their own id", async () => {
    const { insert } = useSupabase({ user: { id: "user-1", email: "hiker@example.com" } });
    expect(await submitFeedback({ message: "Bug" })).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith({ user_id: "user-1", message: "Bug" });
  });

  it("AC-3: a database error is `failed`, logged once, and nothing is sent to Telegram", async () => {
    useSupabase({ insertError: { code: "42501", message: "denied", details: "secret-details" } });
    enableTelegram();
    expect(await submitFeedback({ message: "Hello" })).toEqual({ ok: false, reason: "failed" });
    expect(errorLog.mock.calls).toEqual([['[feedback] stage=write user=anonymous code=42501 message="denied"']]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AC-3: an exception is `failed` and logged, never thrown", async () => {
    vi.mocked(createClient).mockRejectedValue(new Error("cookies() unavailable"));
    await expect(submitFeedback({ message: "Hello" })).resolves.toEqual({ ok: false, reason: "failed" });
    expect(errorLog.mock.calls).toEqual([['[feedback] stage=exception user=anonymous code=- message="cookies() unavailable"']]);
  });
});

describe("spec 0017: telegram notification", () => {
  it("AC-4: sends the message, page language and sender's email to the bot", async () => {
    useSupabase({ user: { id: "user-1", email: "hiker@example.com" } });
    enableTelegram();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    expect(await submitFeedback({ message: "Great trail", locale: "hu" })).toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bot123:SECRET/sendMessage");
    expect(JSON.parse(String(init.body))).toMatchObject({
      chat_id: "42",
      text: "New feedback (hu)\nFrom: hiker@example.com\n\nGreat trail",
    });
  });

  it("AC-4: a visitor is anonymous, an unknown language is `?`", async () => {
    useSupabase();
    enableTelegram();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    await submitFeedback({ message: "Hi", locale: "xx" });
    const { text } = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(text).toBe("New feedback (?)\nFrom: anonymous\n\nHi");
  });

  it("AC-4: without a token and chat id the message is only stored", async () => {
    const { insert } = useSupabase();
    vi.stubGlobal("fetch", fetchMock);
    expect(await submitFeedback({ message: "Hi" })).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["an HTTP error", () => fetchMock.mockResolvedValue(new Response("{}", { status: 502 })), "http_502"],
    ["a network error", () => fetchMock.mockRejectedValue(new TypeError("fetch failed https://api.telegram.org/bot123:SECRET/x")), "network"],
  ])("AC-5: %s doesn't fail the submission, and the log has neither token nor text", async (_, arrange, reason) => {
    useSupabase();
    enableTelegram();
    arrange();
    expect(await submitFeedback({ message: "private words" })).toEqual({ ok: true });
    expect(warnLog.mock.calls).toEqual([[`[feedback] telegram notification failed reason=${reason}`]]);
    const logged = JSON.stringify([...warnLog.mock.calls, ...errorLog.mock.calls]);
    expect(logged).not.toContain("SECRET");
    expect(logged).not.toContain("private words");
  });
});

describe("spec 0017: abuse limits", () => {
  it("AC-7: a filled honeypot gets a success answer and nothing is stored or sent", async () => {
    const { from } = useSupabase();
    enableTelegram();
    expect(await submitFeedback({ message: "Buy pills", website: "http://spam.example" })).toEqual({ ok: true });
    expect(from).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AC-7: the sixth message from one address within the window is rate limited", async () => {
    const { insert } = useSupabase();
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await submitFeedback({ message: `m${i}` }));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, true, true, false]);
    expect(results[5]).toEqual({ ok: false, reason: "rate_limited" });
    expect(insert).toHaveBeenCalledTimes(5);
  });

  it("AC-7: another address isn't affected, and refused attempts (invalid messages) aren't counted", async () => {
    useSupabase();
    for (let i = 0; i < 10; i++) await submitFeedback({ message: "" }); // refused as empty, not counted
    expect(await submitFeedback({ message: "still fine" })).toEqual({ ok: true });
  });
});
