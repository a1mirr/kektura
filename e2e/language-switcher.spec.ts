import { expect, test } from "@playwright/test";
import { signInAsNewUser } from "./helpers";

const NAMES = ["Magyar", "English", "Deutsch", "Русский"];

test.describe("spec 0005: the default language", () => {
  test.describe("a browser in a language we don't have", () => {
    test.use({ locale: "fr-FR" });
    test("AC-9: the address without a language opens Hungarian", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/hu$/);
      await expect(page.locator("html")).toHaveAttribute("lang", "hu");
    });
  });

  for (const [browser, locale] of [["de-DE", "de"], ["ru-RU", "ru"], ["en-GB", "en"], ["hu-HU", "hu"]]) {
    test.describe(`a browser in ${browser}`, () => {
      test.use({ locale: browser });
      test(`AC-9: the address without a language opens ${locale}`, async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveURL(new RegExp(`/${locale}$`));
      });
    });
  }

  test("AC-9: the addresses of every language keep answering, and an unknown language is a 404", async ({ request }) => {
    for (const locale of ["hu", "en", "de", "ru"]) {
      expect((await request.get(`/${locale}`)).status(), locale).toBe(200);
      expect((await request.get(`/${locale}/about`)).status(), locale).toBe(200);
    }
    expect((await request.get("/fr/about")).status()).toBe(404);
  });
});

test.describe("spec 0005: the language dropdown", () => {
  test("AC-10: the landing page has one dropdown with the four languages by their own names, Hungarian first", async ({ page }) => {
    await page.goto("/en");
    const select = page.getByRole("combobox", { name: "Language" });
    await expect(select).toHaveCount(1);
    await expect(select).toHaveValue("en");
    await expect(select.locator("option")).toHaveText(NAMES);
    expect(await select.locator("option").evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value))).toEqual(["hu", "en", "de", "ru"]);
    await expect(page.getByRole("button", { name: /^(HU|EN|DE|RU)$/ })).toHaveCount(0); // no row of buttons any more
  });

  test("AC-10: choosing a language opens the same page in it, and the dropdown follows", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("combobox", { name: "Language" }).selectOption("de");
    await expect(page).toHaveURL(/\/de$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Wandere den Országos Kéktúra — Stempel für Stempel");
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await expect(page.getByRole("combobox", { name: "Sprache" })).toHaveValue("de");
  });

  test("AC-10: the dashboard has it too, and the choice keeps the signed-in page", async ({ page }) => {
    await signInAsNewUser(page);
    await page.getByRole("combobox", { name: "Language" }).selectOption("hu");
    await expect(page).toHaveURL(/\/hu\/dashboard$/);
    await expect(page.getByRole("combobox", { name: "Nyelv" })).toHaveValue("hu");
  });

  test("AC-10: it can be used with the keyboard, is at least 44 px tall and fits 320 px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/en");
    const select = page.getByRole("combobox", { name: "Language" });
    const box = await select.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    const extra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(extra).toBeLessThanOrEqual(0);
    await select.focus();
    await expect(select).toBeFocused();
    await page.keyboard.press("ArrowDown"); // en -> de, as a native dropdown does
    await expect(page).toHaveURL(/\/de$/);
  });
});
