import { describe, expect, it } from "vitest";
import { localizedDescription } from "./stamp-description";

const table = { A: { en: "On the post.", ru: "На столбе." }, B: { en: "Only English." } };

describe("spec 0032: localizedDescription", () => {
  it("AC-1: ru and en use the translation, hu the Hungarian original", () => {
    expect(localizedDescription("A", "Az oszlopon.", "en", table)).toBe("On the post.");
    expect(localizedDescription("A", "Az oszlopon.", "ru", table)).toBe("На столбе.");
    expect(localizedDescription("A", "Az oszlopon.", "hu", table)).toBe("Az oszlopon.");
  });

  it("AC-2: a stamp without a translation in that language keeps the Hungarian original", () => {
    expect(localizedDescription("B", "Csak magyar.", "ru", table)).toBe("Csak magyar.");
    expect(localizedDescription("C", "Ismeretlen.", "en", table)).toBe("Ismeretlen.");
    expect(localizedDescription(null, "Kód nélkül.", "en", table)).toBe("Kód nélkül.");
  });

  it("AC-2: a stamp without any description stays without one", () => {
    expect(localizedDescription("A", null, "hu", table)).toBeNull();
    expect(localizedDescription("Z", null, "en", table)).toBeNull();
  });

  it("AC-1: the real table is used by default", () => {
    expect(localizedDescription("OKTPH_02", "magyar", "en")).toMatch(/^Hét-forrás - .* \(OKTPH_02\)$/);
  });
});
