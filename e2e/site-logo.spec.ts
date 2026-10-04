import { expect, test, type Page } from "@playwright/test";
import { signInAsNewUser } from "./helpers";

const NAMES = {
  en: { link: "Kéktúra tracker: home", text: "Kéktúra tracker" },
  ru: { link: "Трекер Kéktúra: на главную", text: "Трекер Kéktúra" },
  hu: { link: "Kéktúra követő: kezdőlap", text: "Kéktúra követő" },
  de: { link: "Kéktúra-Tracker: Startseite", text: "Kéktúra-Tracker" },
} as const;

const logo = (page: Page, locale: keyof typeof NAMES) => page.getByRole("link", { name: NAMES[locale].link });

async function expectLogo(page: Page, locale: keyof typeof NAMES) {
  const link = logo(page, locale);
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute("href", `/${locale}`);
  await expect(link).toContainText(NAMES[locale].text);
  await expect(link.getByRole("img")).toHaveCount(0); // the mark is decorative: empty alt
  const box = await link.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.x).toBeLessThan(40); // top-left corner
  expect(box!.y).toBeLessThan(80); // below the test banner, above any page content
}

async function expectNoOverflow(page: Page, width: number) {
  await page.setViewportSize({ width, height: 800 });
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(extra).toBeLessThanOrEqual(0);
}

test.describe("spec 0014: site logo", () => {
  for (const locale of ["hu", "en", "de", "ru"] as const) {
    test(`AC-19: the landing page and the About page carry it in ${locale}; a click leads to the landing page`, async ({ page }) => {
      await page.goto(`/${locale}/about`);
      await expectLogo(page, locale);
      await logo(page, locale).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}$`));
      await expectLogo(page, locale);
    });
  }

  test("AC-19: every public page has it, and it fits 320 and 375 px without sideways scrolling", async ({ page }) => {
    for (const path of ["", "/about", "/changelog", "/links", "/feedback"]) {
      await page.goto(`/en${path}`);
      await expectLogo(page, "en");
      for (const width of [320, 375]) await expectNoOverflow(page, width);
    }
  });

  test("AC-19: a signed-in user has it on the dashboard, account and friends pages, and it leads to the dashboard", async ({ page }) => {
    await signInAsNewUser(page);
    for (const path of ["/dashboard", "/account", "/friends"]) {
      await page.goto(`/en${path}`);
      await expectLogo(page, "en");
      for (const width of [320, 375]) await expectNoOverflow(page, width);
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
