import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against the test server: local Supabase + dummy login (spec 0006). Start the
// database first with `npm run testdb:start`. The app is a production build of the test server on
// its own port (a dev server re-renders far too slowly under parallel tests), so it never collides
// with a manual `npm run dev:test` on :3001.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // A GitHub runner has 2 cores and Playwright's default (half of them) ran the whole suite on 1 worker; the tests
  // mostly wait on the server and the database, so more workers than cores pay off (spec 0030 AC-5).
  workers: process.env.CI ? 3 : undefined,
  // In CI the JSON report (path from PLAYWRIGHT_JSON_OUTPUT_NAME) feeds the slowest-tests summary (spec 0030 AC-4).
  reporter: [["list"], ["html", { open: "never" }], ...(process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ? [["json"] as const] : [])],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3002",
    locale: "en-US",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build:e2e && npm run start:e2e",
    url: "http://localhost:3002/en",
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
