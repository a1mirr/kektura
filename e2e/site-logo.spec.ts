import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { routing } from "../src/i18n/routing";
import { signInAsNewUser } from "./helpers";

// The name and the link's accessible name come from the language's own messages file, so every language is
// covered without a fixture here.
type Locale = (typeof routing.locales)[number];
const names = (locale: Locale) => {
  const { app } = JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", `${locale}.json`), "utf8"));
  return { link: app.home as string, text: app.name as string };
};

const logo = (page: Page, locale: Locale) => page.getByRole("link", { name: names(locale).link });

async function expectLogo(page: Page, locale: Locale) {
  const link = logo(page, locale);
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute("href", `/${locale}`);
  await expect(link).toContainText(names(locale).text);
  await expect(link.getByRole("img")).toHaveCount(0); // the mark is decorative: empty alt
  const box = await link.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  // Top-left corner of the content width: the page's left edge on a phone, 64 rem centred on a wide window
  const viewport = await page.evaluate(() => document.documentElement.clientWidth);
  expect(box!.x).toBeLessThan(Math.max(0, (viewport - 1024) / 2) + 40);
  expect(box!.y).toBeLessThan(80); // below the test banner, above any page content
}

// Polled: after the viewport shrinks, a chart that measures its container (the stats page's) takes a frame to follow,
// and reading the width at once sees the old one.
async function expectNoOverflow(page: Page, width: number) {
  await page.setViewportSize({ width, height: 800 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), { message: `sideways scroll at ${width} px` })
    .toBeLessThanOrEqual(0);
}

test.describe("spec 0014: site logo", () => {
  for (const locale of routing.locales) {
    test(`AC-19: the landing page and the About page carry it in ${locale}; a click leads to the landing page`, async ({ page }) => {
      await page.goto(`/${locale}/about`);
      await expectLogo(page, locale);
      await logo(page, locale).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}$`));
      await expectLogo(page, locale);
    });
  }

  test("AC-19: every public page has it, and it fits 375 px without sideways scrolling", async ({ page }) => {
    for (const path of ["", "/about", "/changelog", "/links", "/feedback"]) {
      await page.goto(`/en${path}`);
      await expectLogo(page, "en");
      for (const width of [375]) await expectNoOverflow(page, width);
    }
  });

  test("AC-19: a signed-in user has it on the dashboard, stats, account and friends pages, and it leads to the dashboard", async ({ page }) => {
    await signInAsNewUser(page);
    for (const path of ["/dashboard", "/stats", "/account", "/friends"]) {
      await page.goto(`/en${path}`);
      await expectLogo(page, "en");
      for (const width of [375]) await expectNoOverflow(page, width);
    }
    await logo(page, "en").click();
    await expect(page).toHaveURL(/\/en\/dashboard$/);
  });

  test("AC-19: the 404 page has it too, leading to the default language's main page", async ({ page }) => {
    const response = await page.goto("/en/no-such-page");
    expect(response?.status()).toBe(404);
    await expectLogo(page, "hu");
    await logo(page, "hu").click();
    await expect(page).toHaveURL(/\/hu$/);
  });

  test("AC-19: it can be reached and shown with the keyboard (visible focus ring)", async ({ page }) => {
    await page.goto("/en");
    await page.keyboard.press("Tab");
    const link = logo(page, "en");
    await expect(link).toBeFocused();
    const outline = await link.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
  });

  test("AC-19: the test server's banner stays above it", async ({ page }) => {
    await page.goto("/en");
    const banner = await page.getByRole("status").boundingBox();
    const link = await logo(page, "en").boundingBox();
    expect(banner!.y + banner!.height).toBeLessThanOrEqual(link!.y);
  });

  test("AC-19: the About page no longer carries a text link back", async ({ page }) => {
    await page.goto("/en/about");
    await expect(page.getByRole("link", { name: /Back to the tracker/ })).toHaveCount(0);
  });
});
