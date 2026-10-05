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
  // In CI the JSON report (path from PLAYWRIGHT_JSON_OUTPUT_NAME) feeds the slowest-tests summary (spec 0007 AC-7).
  reporter: [["list"], ["html", { open: "never" }], ...(process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ? [["json"] as const] : [])],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3002",
    locale: "en-US",
    trace: "retain-on-failure",
  },
  // The flags project switches declared flags for everybody, which the other tests must not see (spec 0035 AC-11), so
  // it starts only when the rest has finished. Run it alone with `npx playwright test --project flags --no-deps`.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: "feature-flags.spec.ts" },
    { name: "flags", use: { ...devices["Desktop Chrome"] }, testMatch: "feature-flags.spec.ts", dependencies: ["chromium"] },
  ],
  webServer: {
    command: "npm run build:e2e && npm run start:e2e",
    url: "http://localhost:3002/en",
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
