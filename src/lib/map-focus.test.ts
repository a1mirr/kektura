import { describe, expect, it } from "vitest";
import { fullyInView } from "./map-focus";

describe("spec 0003: the 📍 button and the map's place in the window (AC-13)", () => {
  it("AC-13: a map inside the window needs no scrolling", () => {
    expect(fullyInView({ top: 16, bottom: 300 }, 720)).toBe(true);
    expect(fullyInView({ top: 0, bottom: 720 }, 720)).toBe(true);
  });

  it("AC-13: a map cut off at the top or the bottom, or out of the window, does", () => {
    expect(fullyInView({ top: -1, bottom: 300 }, 720)).toBe(false);
    expect(fullyInView({ top: 400, bottom: 721 }, 720)).toBe(false);
    expect(fullyInView({ top: 900, bottom: 1200 }, 720)).toBe(false);
    expect(fullyInView({ top: -600, bottom: -100 }, 720)).toBe(false);
  });
});
