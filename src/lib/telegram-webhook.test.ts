import { describe, expect, it } from "vitest";
import { createSeenUpdates, isOwner, MAX_UPDATE_BYTES, parseUpdate, secretMatches } from "./telegram-webhook";

const update = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ update_id: 7, message: { text: "/flags", chat: { id: 42 }, from: { id: 42 } }, ...over });

describe("spec 0035: the Telegram webhook helpers", () => {
  it("AC-14: the secret matches only itself, exactly, and an empty secret matches nothing", () => {
    expect(secretMatches("s3cret", "s3cret")).toBe(true);
    for (const given of ["s3cre", "s3cret ", "S3CRET", "", null]) expect(secretMatches(given, "s3cret"), String(given)).toBe(false);
    expect(secretMatches("", "")).toBe(false);
    expect(secretMatches("anything", undefined)).toBe(false);
  });

  it("AC-16: a text message is read, anything else (no text, no ids, bad JSON, too long) is not", () => {
    expect(parseUpdate(update())).toEqual({ updateId: 7, chatId: "42", fromId: "42", text: "/flags" });
    expect(parseUpdate(update({ message: { chat: { id: 42 }, from: { id: 42 } } }))).toBeNull(); // a photo, a sticker
    expect(parseUpdate(update({ message: { text: "x", chat: { id: "42" }, from: { id: 42 } } }))).toBeNull();
    expect(parseUpdate(update({ message: { text: 5, chat: { id: 42 }, from: { id: 42 } } }))).toBeNull();
    expect(parseUpdate(update({ update_id: undefined }))).toBeNull();
    expect(parseUpdate(JSON.stringify({ update_id: 1, edited_message: { text: "x" } }))).toBeNull();
    expect(parseUpdate("not json")).toBeNull();
    expect(parseUpdate("null")).toBeNull();
    expect(parseUpdate(update({ message: { text: "x".repeat(MAX_UPDATE_BYTES), chat: { id: 42 }, from: { id: 42 } } }))).toBeNull();
  });

  it("AC-15: only the configured chat, written by that same sender, is the owner", () => {
    const from = (chatId: string, fromId: string) => ({ updateId: 1, chatId, fromId, text: "x" });
    expect(isOwner(from("42", "42"), "42")).toBe(true);
    expect(isOwner(from("42", "43"), "42")).toBe(false); // someone else in the owner's group chat
    expect(isOwner(from("43", "42"), "42")).toBe(false);
    expect(isOwner(from("-42", "42"), "42")).toBe(false);
  });

  it("AC-16: an update id is new once, and the memory is bounded", () => {
    const seen = createSeenUpdates(3);
    expect([seen.first(1), seen.first(1), seen.first(2)]).toEqual([true, false, true]);
    seen.first(3);
    seen.first(4); // 1 is forgotten
    expect(seen.first(4)).toBe(false);
    expect(seen.first(1)).toBe(true);
  });
});
