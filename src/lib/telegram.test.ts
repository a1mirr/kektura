import { describe, expect, it, vi } from "vitest";
import { sendTelegramMessage, TELEGRAM_MAX_TEXT, telegramConfig } from "./telegram";

const config = { token: "123:SECRET", chatId: "42" };
const okFetch = () => vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
const sentBody = (fetchImpl: ReturnType<typeof okFetch>) =>
  JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body));

describe("spec 0017: telegram configuration", () => {
  it("AC-4: needs both the token and the chat id", () => {
    expect(telegramConfig({ TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "c" })).toEqual({
      token: "t",
      chatId: "c",
      apiBase: undefined,
    });
    expect(telegramConfig({ TELEGRAM_BOT_TOKEN: "t" })).toBeNull();
    expect(telegramConfig({ TELEGRAM_CHAT_ID: "c" })).toBeNull();
    expect(telegramConfig({ TELEGRAM_BOT_TOKEN: "  ", TELEGRAM_CHAT_ID: "c" })).toBeNull();
    expect(telegramConfig({})).toBeNull();
  });
});

describe("spec 0017: sending to telegram", () => {
  it("AC-4: posts plain text (no parse_mode) to the bot's sendMessage", async () => {
    const fetchImpl = okFetch();
    expect(await sendTelegramMessage("hello <b>there</b> *x*", config, { fetchImpl })).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bot123:SECRET/sendMessage");
    expect(init.method).toBe("POST");
    const body = sentBody(fetchImpl);
    expect(body).toEqual({ chat_id: "42", text: "hello <b>there</b> *x*", disable_web_page_preview: true });
    expect(body).not.toHaveProperty("parse_mode");
  });

  it("AC-4: a different API base (tests, a local fake) is honoured", async () => {
    const fetchImpl = okFetch();
    await sendTelegramMessage("x", { ...config, apiBase: "http://127.0.0.1:9999" }, { fetchImpl });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe("http://127.0.0.1:9999/bot123:SECRET/sendMessage");
  });

  it("AC-4: text over Telegram's limit is cut, ending with an ellipsis", async () => {
    const fetchImpl = okFetch();
    await sendTelegramMessage("a".repeat(TELEGRAM_MAX_TEXT + 500), config, { fetchImpl });
    const { text } = sentBody(fetchImpl);
    expect(text).toHaveLength(TELEGRAM_MAX_TEXT);
    expect(text.endsWith("…")).toBe(true);
  });

  it("AC-5: a non-2xx answer is a short reason, without the body or the URL", async () => {
    const fetchImpl = vi.fn(async () => new Response('{"description":"Unauthorized, token 123:SECRET"}', { status: 401 }));
    const result = await sendTelegramMessage("x", config, { fetchImpl });
    expect(result).toEqual({ ok: false, reason: "http_401" });
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });

  it("AC-5: a network error is `network`, and its message (which can hold the URL) is dropped", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed: https://api.telegram.org/bot123:SECRET/sendMessage");
    });
    const result = await sendTelegramMessage("x", config, { fetchImpl });
    expect(result).toEqual({ ok: false, reason: "network" });
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });

  it("AC-5: a slow Telegram is cut off with `timeout`", async () => {
    const fetchImpl = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
        }),
    );
    const result = await sendTelegramMessage("x", config, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 20,
    });
    expect(result).toEqual({ ok: false, reason: "timeout" });
  });
});
