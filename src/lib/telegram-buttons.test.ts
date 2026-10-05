import { describe, expect, it, vi } from "vitest";
import { answerTelegramCallback, editTelegramMessage, sendTelegramMessage, TELEGRAM_MAX_TEXT } from "./telegram";

const config = { token: "123:SECRET", chatId: "42" };
const okFetch = () => vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
const sentBody = (fetchImpl: ReturnType<typeof okFetch>) =>
  JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body));
const urlOf = (fetchImpl: ReturnType<typeof okFetch>) => (fetchImpl.mock.calls[0] as unknown as [string])[0];

describe("spec 0035: messages with buttons, edits and answers to taps", () => {
  const keyboard = [[{ text: "off", callback_data: "m:friends:off:on" }]];

  it("AC-27: a message can carry an inline keyboard, and without one has no reply_markup", async () => {
    const fetchImpl = okFetch();
    await sendTelegramMessage("panel", config, { fetchImpl, keyboard });
    expect(sentBody(fetchImpl)).toEqual({ chat_id: "42", text: "panel", disable_web_page_preview: true, reply_markup: { inline_keyboard: keyboard } });
    const plain = okFetch();
    await sendTelegramMessage("panel", config, { fetchImpl: plain });
    expect(sentBody(plain)).not.toHaveProperty("reply_markup");
  });

  it("AC-30: an edit replaces the text and the buttons of the message, as plain text and cut at the limit", async () => {
    const fetchImpl = okFetch();
    expect(await editTelegramMessage(77, "x".repeat(TELEGRAM_MAX_TEXT + 10), config, { fetchImpl, keyboard })).toEqual({ ok: true });
    expect(urlOf(fetchImpl)).toBe("https://api.telegram.org/bot123:SECRET/editMessageText");
    const body = sentBody(fetchImpl);
    expect(body).toMatchObject({ chat_id: "42", message_id: 77, reply_markup: { inline_keyboard: keyboard } });
    expect(body.text).toHaveLength(TELEGRAM_MAX_TEXT);
    expect(body).not.toHaveProperty("parse_mode");
    const bare = okFetch();
    await editTelegramMessage(77, "no buttons", config, { fetchImpl: bare });
    expect(sentBody(bare).reply_markup).toEqual({ inline_keyboard: [] });
  });

  it("AC-30: an answer to a tap names the tap, and its notice is cut to 200 characters", async () => {
    const fetchImpl = okFetch();
    expect(await answerTelegramCallback("cb-1", "y".repeat(300), config, { fetchImpl })).toEqual({ ok: true });
    expect(urlOf(fetchImpl)).toBe("https://api.telegram.org/bot123:SECRET/answerCallbackQuery");
    expect(sentBody(fetchImpl)).toEqual({ callback_query_id: "cb-1", text: "y".repeat(200) });
    const silent = okFetch();
    await answerTelegramCallback("cb-1", undefined, config, { fetchImpl: silent });
    expect(sentBody(silent)).toEqual({ callback_query_id: "cb-1" });
  });

  it("AC-30: a refused edit or a network error is a short reason, never the URL with the token", async () => {
    const refused = vi.fn(async () => new Response("{}", { status: 400 }));
    expect(await editTelegramMessage(1, "x", config, { fetchImpl: refused })).toEqual({ ok: false, reason: "http_400" });
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed https://api.telegram.org/bot123:SECRET/answerCallbackQuery");
    });
    const result = await answerTelegramCallback("cb", "x", config, { fetchImpl: down });
    expect(result).toEqual({ ok: false, reason: "network" });
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
});
