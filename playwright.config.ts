import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }], ...(process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ? [["json"] as const] : [])],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3002",
    locale: "en-US",
    trace: "retain-on-failure",
  },
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
