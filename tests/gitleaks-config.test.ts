// It extends the default rules and allows exactly the local Supabase demo keys, by value; nothing else may be
// allowed, so a new allow-list entry shows up here.
import fs from "node:fs";
import { describe, expect, it } from "vitest";

const config = fs.readFileSync(new URL("../.gitleaks.toml", import.meta.url), "utf8");
// The configuration without its comments, which may name anything.
const code = config
  .split("\n")
  .filter((line) => !line.trim().startsWith("#"))
  .join("\n");
const regexes = [...(code.match(/regexes = \[([\s\S]*?)\n\]/)?.[1] ?? "").matchAll(/'''(.*?)'''/g)].map((m) => m[1]);

describe("spec 0007: the gitleaks configuration", () => {
  it("AC-16: extends the default rules and switches none of them off", () => {
    expect(code).toMatch(/\[extend\]\s*\nuseDefault = true\b/);
    expect(code).not.toMatch(/\[\[rules\]\]|disabledRules|\[extend\][^[]*(path|url) =/);
  });

  it("AC-16: has one allow-list, and it allows by value: no path, commit, stopword or other rule of its own", () => {
    expect(code.match(/^\[\[?allowlists?\]\]/gm)).toEqual(["[[allowlists]]"]);
    const keys = code.split("\n").filter((line) => /^[a-zA-Z]+ = /.test(line)).map((line) => line.split(" = ")[0]);
    expect(keys).toEqual(["title", "useDefault", "description", "regexTarget", "regexes"]);
    expect(code).toContain('regexTarget = "secret"'); // the value of the finding, not the line around it
    expect(regexes.length).toBeGreaterThan(0);
  });

  it("AC-16: every entry is the whole value of a Supabase demo key: anchored, written out, and a token issued by supabase-demo", () => {
    for (const regex of regexes) {
      expect(regex.startsWith("^") && regex.endsWith("$"), regex).toBe(true);
      const key = regex.slice(1, -1).replaceAll("\\.", ".");
      expect(key, "only the characters of a token, no pattern").toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
      const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
      expect(payload.iss, "a key of the local Supabase").toBe("supabase-demo");
      // the entry matches the key, and nothing that only contains it or is a part of it
      const re = new RegExp(regex);
      expect(re.test(key)).toBe(true);
      expect(re.test(`${key}x`)).toBe(false);
      expect(re.test(`x${key}`)).toBe(false);
      expect(re.test(key.slice(0, -1))).toBe(false);
    }
  });

  it("AC-16: the demo keys are the only values the configuration names, and it holds no other key or token", () => {
    const outside = code.replace(/regexes = \[[\s\S]*?\n\]/, "");
    expect(outside).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}|sb_(secret|publishable)_|[A-Za-z0-9_-]{40,}/);
  });
});
