import { describe, expect, it } from "vitest";
import { isTestEmail, testLoginEnabled } from "./test-login";

const LOCAL = "http://127.0.0.1:54321";

describe("spec 0006: dummy login guard", () => {
  it.each([LOCAL, "http://localhost:54321", "http://[::1]:54321"])("AC-4: on with TEST_LOGIN=1 and a local Supabase (%s)", (url) => {
    expect(testLoginEnabled({ TEST_LOGIN: "1", NEXT_PUBLIC_SUPABASE_URL: url })).toBe(true);
  });

  it.each([
    ["the flag is missing", { NEXT_PUBLIC_SUPABASE_URL: LOCAL }],
    ["the flag is not exactly 1", { TEST_LOGIN: "true", NEXT_PUBLIC_SUPABASE_URL: LOCAL }],
    ["Supabase is remote (production)", { TEST_LOGIN: "1", NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" }],
    ["a remote host only looks local", { TEST_LOGIN: "1", NEXT_PUBLIC_SUPABASE_URL: "https://localhost.evil.example" }],
    ["the Supabase URL is missing", { TEST_LOGIN: "1" }],
    ["the Supabase URL is garbage", { TEST_LOGIN: "1", NEXT_PUBLIC_SUPABASE_URL: "not a url" }],
  ])("AC-4: off when %s", (_, env) => {
    expect(testLoginEnabled(env)).toBe(false);
  });

  it("AC-3: accepts plausible emails only", () => {
    expect(isTestEmail("tester@kektura.test")).toBe(true);
    expect(isTestEmail("e2e-123@kektura.test")).toBe(true);
    expect(isTestEmail("")).toBe(false);
    expect(isTestEmail("no-at-sign")).toBe(false);
    expect(isTestEmail("a b@c.d")).toBe(false);
    expect(isTestEmail(`${"x".repeat(250)}@a.bc`)).toBe(false);
  });
});
