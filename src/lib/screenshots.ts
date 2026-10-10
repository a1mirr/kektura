// Written by `npm run screenshots` at exactly this size: 390 x 760 CSS pixels at a device scale of 2.

export const SCREENSHOT_SIZE = { width: 780, height: 1520 } as const;

export const SCREENSHOTS_BUDGET_BYTES = 2_500_000;

export const SCREENSHOTS = ["dashboard", "map", "route"] as const;

export type ScreenshotName = (typeof SCREENSHOTS)[number];

export const screenshotPath = (name: ScreenshotName) => `/screenshots/${name}.png`;
