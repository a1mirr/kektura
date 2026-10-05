import { describe, expect, it } from "vitest";
import { MAX_UPDATE_BYTES, parseCallback, parseUpdate } from "./telegram-webhook";

const tap = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ update_id: 9, callback_query: { id: "cb", data: "p", from: { id: 42 }, message: { message_id: 77, chat: { id: 42 } }, ...over } });
const text = JSON.stringify({ update_id: 7, message: { text: "/flags", chat: { id: 42 }, from: { id: 42 } } });

describe("spec 0035: taps on the bot's buttons", () => {
  it("AC-30: a tap is read with who tapped, the message it was under and its data", () => {
    expect(parseCallback(tap())).toEqual({ updateId: 9, chatId: "42", fromId: "42", callbackId: "cb", messageId: 77, data: "p" });
  });

  it("AC-30: anything else is not a tap: wrong types, no data, no message, a text message, bad JSON, too long", () => {
    expect(parseCallback(tap({ id: 5 }))).toBeNull();
    expect(parseCallback(tap({ data: undefined }))).toBeNull(); // a button without data
    expect(parseCallback(tap({ message: undefined }))).toBeNull(); // nothing to edit
    expect(parseCallback(tap({ from: { id: "42" } }))).toBeNull();
    expect(parseCallback(text)).toBeNull();
    expect(parseUpdate(tap())).toBeNull(); // and a tap is not a text message
    expect(parseCallback("not json")).toBeNull();
    expect(parseCallback("null")).toBeNull();
    expect(parseCallback(tap({ data: "x".repeat(MAX_UPDATE_BYTES) }))).toBeNull();
  });
});
