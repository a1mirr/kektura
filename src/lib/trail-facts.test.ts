import { describe, expect, it } from "vitest";
import { TRAIL_FACTS, trailFacts } from "./trail-facts";

describe("spec 0015: trail facts", () => {
  it("AC-2: counts stages and places and sums the lengths", () => {
    expect(
      trailFacts([
        { km: 71.7, places: ["a", "b", "c"] },
        { km: 72.6, places: ["d", "e"] },
      ]),
    ).toEqual({ stages: 2, places: 5, km: 144.3 });
  });

  it("AC-2: kilometres are rounded to 0.1, without floating-point noise", () => {
    // 0.1 + 0.2 is 0.30000000000000004 in floating point.
    expect(trailFacts([{ km: 0.1, places: [] }, { km: 0.2, places: [] }]).km).toBe(0.3);
  });

  it("AC-2: no stages, no facts", () => {
    expect(trailFacts([])).toEqual({ stages: 0, places: 0, km: 0 });
  });

  it("AC-2: the real stage table gives the official numbers", () => {
    expect(TRAIL_FACTS).toEqual({ stages: 27, places: 161, km: 1183.1 });
  });
});
