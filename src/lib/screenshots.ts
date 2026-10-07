// The landing page's gallery (spec 0038): the screens, in the order they are shown, and the size every picture has.
// `npm run screenshots` (scripts/screenshots.mjs) writes `public/screenshots/<name>.png` at exactly this size
// (390 x 760 CSS pixels at a device scale of 2); tests/screenshots.test.ts checks the files against it.

export const SCREENSHOT_SIZE = { width: 780, height: 1520 } as const;

// A budget for the whole gallery, in bytes (spec 0038 AC-9): a picture that grows past it fails the test.
export const SCREENSHOTS_BUDGET_BYTES = 2_500_000;

export const SCREENSHOTS = ["dashboard", "map", "route"] as const;

export type ScreenshotName = (typeof SCREENSHOTS)[number];

export const screenshotPath = (name: ScreenshotName) => `/screenshots/${name}.png`;
