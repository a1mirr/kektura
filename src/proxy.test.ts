import { describe, expect, it } from "vitest";
import { config } from "./proxy";

// Next anchors the matcher and treats the group as a regular expression.
const matches = (path: string) => config.matcher.some((m) => new RegExp(`^${m}$`).test(path));

describe("spec 0005: proxy matcher", () => {
  it.each(["/", "/ru", "/en/dashboard", "/hu/dashboard", "/de", "/de/dashboard"])("AC-1: runs on page %s", (path) => {
    expect(matches(path)).toBe(true);
  });

  it.each(["/auth/callback", "/_next/static/chunk.js", "/data/okt-route.json", "/maplibre/maplibre-gl-worker.mjs", "/favicon.ico"])(
    "AC-1: skips %s",
    (path) => {
      expect(matches(path)).toBe(false);
    },
  );
});
