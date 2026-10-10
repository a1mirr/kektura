import { defineConfig, devices } from "@playwright/test";

// Start the database first with `npm run testdb:start`. The app is a production build of the test server on its own
// port (a dev server re-renders far too slowly under parallel tests), so it never collides with a manual `npm run
// dev:test` on :3001.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // In CI the JSON report (path from PLAYWRIGHT_JSON_OUTPUT_NAME) feeds the slowest-tests summary.
  reporter: [["list"], ["html", { open: "never" }], ...(process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ? [["json"] as const] : [])],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3002",
    locale: "en-US",
    trace: "retain-on-failure",
  },
  // `chromium` runs everything except the tests tagged `@mobile`, which the `mobile` project runs alone, as a phone:
  // Chromium at 375 x 812 with touch and mobile emulation (375 px is the narrowest width the layout promises). The
  // flags project switches declared flags for everybody, which the other tests must not see, so it starts only when
  // the rest has finished. Run it alone with `npx playwright test --project flags --no-deps`, the phone tests with
  // `npx playwright test --project mobile`.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: "feature-flags.spec.ts", grepInvert: /@mobile/ },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"], viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true },
      testIgnore: "feature-flags.spec.ts",
      grep: /@mobile/,
    },
    { name: "flags", use: { ...devices["Desktop Chrome"] }, testMatch: "feature-flags.spec.ts", dependencies: ["chromium", "mobile"] },
  ],
  webServer: {
    command: "npm run build:e2e && npm run start:e2e",
    url: "http://localhost:3002/en",
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
