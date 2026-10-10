import { describe, expect, it } from "vitest";
import { hasToleranceNote, requiredNote } from "./new-stamps";

const place = (...codes: (string | null)[]) => ({ variants: codes.map((code) => ({ code })) }) as never;

describe("spec 0003: the popup note of a new stamp", () => {
  const text = { requiredFrom: (date: string) => `required from ${date}`, notRequired: "not required for your walk" };
  const format = (iso: string) => `<${iso}>`;

  it("AC-22: the date, and when the user walked past before it the waiver", () => {
    expect(requiredNote("2025-05-08", false, text, format)).toBe("required from <2025-05-08>");
    expect(requiredNote("2025-05-08", true, text, format)).toBe("required from <2025-05-08> · not required for your walk");
  });

  it("AC-22: a place that was always required has no note", () => {
    expect(requiredNote(null, false, text, format)).toBeUndefined();
    expect(requiredNote(null, true, text, format)).toBeUndefined();
  });
});

describe("spec 0001: the tolerance sentence", () => {
  it("AC-19: only a place with a stamp the MTSZ announced a tolerance for has one", () => {
    expect(hasToleranceNote(place("OKTPH_30_B"))).toBe(true);
    expect(hasToleranceNote(place("OKTPH_103"))).toBe(false);
    expect(hasToleranceNote(place("OKTPH_132_B_1", "OKTPH_132_B_2"))).toBe(false);
    expect(hasToleranceNote(place(null, "OKTPH_97_B"))).toBe(true);
  });

  it("AC-19: any variant of a flagged set counts", () => {
    expect(hasToleranceNote(place("A", "B"), new Set(["B"]))).toBe(true);
    expect(hasToleranceNote(place("A"), new Set(["B"]))).toBe(false);
  });
});
