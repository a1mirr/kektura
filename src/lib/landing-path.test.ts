import { describe, expect, it } from "vitest";
import { landingPath } from "./landing-path";

describe("spec 0005: landing path after sign-in", () => {
  it("AC-4: a path inside the site is kept, anything else means the dashboard", () => {
    expect(landingPath("/friends/invite/abc")).toBe("/friends/invite/abc");
    for (const next of [null, undefined, "", "friends", "https://evil.example", 42]) expect(landingPath(next)).toBe("/dashboard");
  });
});
