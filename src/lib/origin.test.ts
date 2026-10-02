import { describe, expect, it } from "vitest";
import { requestOrigin } from "./origin";

const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });
const BEHIND_CADDY = "http://localhost:3000/auth/callback?code=x";

describe("spec 0020: request origin", () => {
  it("AC-1: SITE_URL wins over everything the request says", () => {
    const request = req(BEHIND_CADDY, { "x-forwarded-host": "evil.example", "x-forwarded-proto": "http" });
    expect(requestOrigin(request, { SITE_URL: "https://kektura-tracker.com" })).toBe("https://kektura-tracker.com");
    expect(requestOrigin(request, { SITE_URL: "https://kektura-tracker.com/some/path?x=1" })).toBe("https://kektura-tracker.com");
    expect(requestOrigin(request, { SITE_URL: " http://127.0.0.1:3000 " })).toBe("http://127.0.0.1:3000");
  });

  it.each(["", "   ", "not a url", "javascript:alert(1)", "ftp://example.com", "//example.com"])(
    "AC-1: an unusable SITE_URL (%j) is ignored",
    (SITE_URL) => {
      const request = req(BEHIND_CADDY, { "x-forwarded-host": "kektura-tracker.com", "x-forwarded-proto": "https" });
      expect(requestOrigin(request, { SITE_URL })).toBe("https://kektura-tracker.com");
    },
  );

  it("AC-1: behind the proxy, the forwarded host and scheme are the user's address", () => {
    const request = req(BEHIND_CADDY, { "x-forwarded-host": "kektura-tracker.com", "x-forwarded-proto": "https" });
    expect(requestOrigin(request, {})).toBe("https://kektura-tracker.com");
  });

  it("AC-1: the first value of a list is used (a chain of proxies)", () => {
    const request = req(BEHIND_CADDY, { "x-forwarded-host": "kektura-tracker.com, internal:3000", "x-forwarded-proto": "https, http" });
    expect(requestOrigin(request, {})).toBe("https://kektura-tracker.com");
  });

  it("AC-1: no forwarded scheme means the request's own scheme, not a made-up http", () => {
    expect(requestOrigin(req("https://kektura-tracker.com/auth/callback", { "x-forwarded-host": "kektura-tracker.com" }), {})).toBe(
      "https://kektura-tracker.com",
    );
    expect(requestOrigin(req(BEHIND_CADDY, { "x-forwarded-host": "kektura-tracker.com" }), {})).toBe("http://kektura-tracker.com");
  });

  it("AC-1: without forwarded headers the host header, then the request's own origin", () => {
    expect(requestOrigin(req("http://localhost:3002/auth/sign-out", { host: "localhost:3002" }), {})).toBe("http://localhost:3002");
    expect(requestOrigin(req("http://localhost:3002/auth/sign-out"), {})).toBe("http://localhost:3002");
  });

  it.each([
    ["a path", "evil.example/login"],
    ["user info", "user@evil.example"],
    ["a space", "evil example"],
    ["a scheme", "https://evil.example"],
    ["a query", "evil.example?x=1"],
    ["a port that isn't one", "evil.example:abc"],
    ["a backslash", "evil.example\\@good.example"],
  ])("AC-2: a forwarded host with %s is ignored", (_, host) => {
    const request = req("http://localhost:3000/x", { "x-forwarded-host": host, "x-forwarded-proto": "https" });
    expect(requestOrigin(request, {})).toBe("http://localhost:3000");
  });

  it.each(["javascript", "ftp", "https://", ""])("AC-2: a forwarded scheme of %j is ignored", (proto) => {
    const request = req("http://localhost:3000/x", { "x-forwarded-host": "kektura-tracker.com", "x-forwarded-proto": proto });
    expect(requestOrigin(request, {})).toBe(proto === "" ? "http://kektura-tracker.com" : "http://localhost:3000");
  });

  it("AC-2: addresses, ports and IPv6 are fine", () => {
    for (const host of ["188.166.117.212", "188.166.117.212:3000", "localhost:3001", "[::1]:3000", "sub.kektura-tracker.com"]) {
      expect(requestOrigin(req("http://localhost:3000/x", { "x-forwarded-host": host, "x-forwarded-proto": "https" }), {})).toBe(
        `https://${host}`,
      );
    }
  });

  it("AC-2: never produces null or undefined parts, whatever is missing", () => {
    const origin = requestOrigin(req("http://localhost:3000/x"), {});
    expect(origin).not.toMatch(/null|undefined/);
    expect(origin).toBe("http://localhost:3000");
  });
});
