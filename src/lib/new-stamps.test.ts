import { describe, expect, it } from "vitest";
import { hasToleranceNote } from "./new-stamps";

const place = (...codes: (string | null)[]) => ({ variants: codes.map((code) => ({ code })) }) as never;

describe("spec 0001: the tolerance sentence", () => {
  it("AC-19: only a place with a stamp the MTSZ announced a tolerance for has one", () => {
    // Badacsony (2025) is flagged in scripts/data/okt-stamp-dates.json, Vércverés (2014) is not.
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
