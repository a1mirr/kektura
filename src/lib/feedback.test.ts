import { describe, expect, it } from "vitest";
import { characterCount, FEEDBACK_MAX, formatFeedbackNotification, messageLimit, parseStampCode, stampPrefix, validateFeedback } from "./feedback";

describe("spec 0017: feedback validation", () => {
  it("AC-2: trims, normalises line endings and accepts a normal message", () => {
    expect(validateFeedback("  Great app!\r\nOne idea:\rmore maps  ")).toEqual({
      ok: true,
      message: "Great app!\nOne idea:\nmore maps",
    });
  });

  it("AC-2: empty and whitespace-only messages are refused", () => {
    expect(validateFeedback("")).toEqual({ ok: false, reason: "empty" });
    expect(validateFeedback(" \n\t ")).toEqual({ ok: false, reason: "empty" });
  });

  it("AC-2: the limit is 2000 characters, counted like Postgres (an emoji is one)", () => {
    expect(validateFeedback("a".repeat(FEEDBACK_MAX)).ok).toBe(true);
    expect(validateFeedback("a".repeat(FEEDBACK_MAX + 1))).toEqual({ ok: false, reason: "too_long" });
    expect(validateFeedback("😀".repeat(FEEDBACK_MAX)).ok).toBe(true); // 4000 UTF-16 units, 2000 characters
    expect(validateFeedback("😀".repeat(FEEDBACK_MAX + 1)).ok).toBe(false);
    expect(characterCount("  😀😀 ")).toBe(2);
  });

  it.each([[undefined], [null], [42], [["a"]], [{ message: "a" }]])("AC-10: %j is invalid, not a crash", (value) => {
    expect(validateFeedback(value)).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("spec 0017: notification text", () => {
  it("AC-4: names the language, the sender and the message", () => {
    expect(formatFeedbackNotification({ message: "Hi", locale: "hu", senderEmail: "a@b.hu" })).toBe(
      "New feedback (hu)\nFrom: a@b.hu\n\nHi",
    );
  });

  it("AC-4: a visitor is anonymous", () => {
    expect(formatFeedbackNotification({ message: "Hi", locale: "en" })).toContain("From: anonymous");
    expect(formatFeedbackNotification({ message: "Hi", locale: "en", senderEmail: "" })).toContain("From: anonymous");
  });
});

describe("spec 0017: a report about a stamp", () => {
  it("AC-11: only a string of the shape of a stamp code is a code: nothing else of the address can reach the form", () => {
    for (const ok of ["OKTPH_84_B", "OKTPH_132_B_1", "OKTPH_01_DDKPH_01_1", "OKTPH_103"]) expect(parseStampCode(ok), ok).toBe(ok);
    const bad = [
      "Please send money to me",
      "OKTPH_84_B ",
      "OKTPH_84_B\nsecond line",
      "<script>alert(1)</script>",
      "OKTPH_",
      "okt_retired_nyirjesi",
      "OKTPH_1 OR 1=1",
      "",
      42,
      null,
      undefined,
      ["OKTPH_84_B"],
      { code: "OKTPH_84_B" },
    ];
    for (const value of bad) expect(parseStampCode(value), JSON.stringify(value)).toBeNull();
  });

  it("AC-11: the line before the sender's words names the stamp, in English, and a stamp takes its share of the 2000 characters", () => {
    const stamp = { code: "OKTPH_84_B", name: "Lokó-pihenő" };
    expect(stampPrefix(stamp)).toBe("Stamp: Lokó-pihenő (OKTPH_84_B)\n\n");
    expect(messageLimit(null)).toBe(FEEDBACK_MAX);
    expect(messageLimit()).toBe(FEEDBACK_MAX);
    expect(messageLimit(stamp)).toBe(FEEDBACK_MAX - [...stampPrefix(stamp)].length);
    expect(messageLimit(stamp)).toBeLessThan(FEEDBACK_MAX);
  });
});
