import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("spec 0017: rate limiter", () => {
  it("AC-7: allows `limit` calls per window and refuses the next", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000, now: () => 0 });
    expect([1, 2, 3, 4].map(() => limiter.allow("ip"))).toEqual([true, true, true, false]);
  });

  it("AC-7: keys are independent", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });
    expect(limiter.allow("a")).toBe(true);
    expect(limiter.allow("a")).toBe(false);
    expect(limiter.allow("b")).toBe(true);
  });

  it("AC-7: the window slides: old calls stop counting", () => {
    let t = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
    limiter.allow("ip"); // t=0
    t = 600;
    limiter.allow("ip"); // t=600
    t = 900;
    expect(limiter.allow("ip")).toBe(false);
    t = 1001; // the call at t=0 has expired, the one at t=600 hasn't
    expect(limiter.allow("ip")).toBe(true);
    expect(limiter.allow("ip")).toBe(false);
  });

  it("AC-7: refused calls are not counted against the key", () => {
    let t = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => t });
    limiter.allow("ip");
    for (t = 100; t < 900; t += 100) expect(limiter.allow("ip")).toBe(false);
    t = 1000; // only the first call counted: the window is clear again
    expect(limiter.allow("ip")).toBe(true);
  });
});
