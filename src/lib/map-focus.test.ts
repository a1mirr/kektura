import { describe, expect, it } from "vitest";
import { centeredScrollTop, fullyInView } from "./map-focus";

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

  it("AC-13: a map inside the window but cut off by the scrolling block it sits in is not in view", () => {
    const block = { top: 12, bottom: 700 };
    expect(fullyInView({ top: 60, bottom: 400 }, 720, block)).toBe(true);
    expect(fullyInView({ top: 30, bottom: 400 }, 720, block)).toBe(true);
    expect(fullyInView({ top: 0, bottom: 400 }, 720, block)).toBe(false);
    expect(fullyInView({ top: 300, bottom: 705 }, 720, block)).toBe(false);
  });

  it("AC-13: a block taller than the window never makes a map outside the window count as in view", () => {
    expect(fullyInView({ top: 400, bottom: 800 }, 720, { top: 16, bottom: 900 })).toBe(false);
    expect(fullyInView({ top: -20, bottom: 300 }, 720, { top: -100, bottom: 900 })).toBe(false);
    expect(fullyInView({ top: 100, bottom: 300 }, 720, null)).toBe(true);
  });
});

describe("spec 0003: centring the map in the block that scrolls (AC-13)", () => {
  it("AC-13: scrolls down by what the map's middle is below the block's middle, never above the start", () => {
    const block = { top: 16, bottom: 584 };
    expect(centeredScrollTop({ top: 400, bottom: 784 }, block, 0)).toBe(292 + 0);
    expect(centeredScrollTop({ top: -12, bottom: 372 }, block, 80)).toBe(0); // map middle 180: up by 120, more than the 80 there is
    expect(centeredScrollTop({ top: 68, bottom: 452 }, block, 0)).toBe(0);
  });
});
