import { describe, expect, it } from "vitest";
import { FLAG_KEYS, FLAG_MODES, FLAGS, isEnabled, isFlagKey, isFlagMode, resolveFlags } from "./feature-flags";

describe("spec 0035: the registry", () => {
  it("AC-1: every flag has a kebab-case key, a one-line description and a default mode", () => {
    expect(FLAG_KEYS.length).toBeGreaterThan(0);
    for (const key of FLAG_KEYS) {
      expect(key, key).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
      expect(FLAGS[key].description, key).toMatch(/^[^\n]+$/);
      expect(isFlagMode(FLAGS[key].default), key).toBe(true);
    }
  });

  it("AC-1: a key is a declared flag only if it is in the registry", () => {
    expect(isFlagKey("friends")).toBe(true);
    expect(isFlagKey("not-a-flag")).toBe(false);
    expect(isFlagKey("toString")).toBe(false); // an inherited property is not a flag
    // @ts-expect-error asking for a flag that is not declared fails typecheck
    const undeclared: keyof typeof FLAGS = "not-a-flag";
    expect(undeclared).toBe("not-a-flag");
  });

  it("AC-2: a flag is off, on an allowlist or on", () => {
    expect([...FLAG_MODES]).toEqual(["off", "allowlist", "on"]);
    expect(isFlagMode("percent")).toBe(false);
  });
});

describe("spec 0035: resolving flags", () => {
  it("AC-3: `on` is true for everybody, `allowlist` only for a listed viewer, `off` for nobody", () => {
    expect(isEnabled("on", false)).toBe(true);
    expect(isEnabled("on", true)).toBe(true);
    expect(isEnabled("allowlist", true)).toBe(true);
    expect(isEnabled("allowlist", false)).toBe(false);
    expect(isEnabled("off", false)).toBe(false);
    expect(isEnabled("off", true)).toBe(false); // an entry on the list of an `off` flag changes nothing
  });

  it("AC-3: every declared flag is resolved from its stored row, and a missing row uses the default", () => {
    const flags = resolveFlags([{ key: "friends", mode: "on", listed: false }]);
    expect(flags.friends).toBe(true);
    expect(flags.restaurants).toBe(isEnabled(FLAGS.restaurants.default, false));
    expect(Object.keys(flags).sort()).toEqual([...FLAG_KEYS].sort());
    expect(resolveFlags([{ key: "friends", mode: "allowlist", listed: true }]).friends).toBe(true);
    expect(resolveFlags([{ key: "friends", mode: "allowlist", listed: false }]).friends).toBe(false);
  });

  it("AC-3: stored keys that are not declared, and modes the code does not know, are ignored", () => {
    const flags = resolveFlags([
      { key: "retired-feature", mode: "on", listed: true },
      { key: "friends", mode: "half", listed: true },
    ]);
    expect(Object.keys(flags)).not.toContain("retired-feature");
    expect(flags.friends).toBe(isEnabled(FLAGS.friends.default, false));
  });

  it("AC-9: with no answer (the lookup failed) every flag has its default", () => {
    const flags = resolveFlags(null);
    for (const key of FLAG_KEYS) expect(flags[key], key).toBe(isEnabled(FLAGS[key].default, false));
  });
});
