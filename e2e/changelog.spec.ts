import { expect, test } from "@playwright/test";

const noHorizontalScroll = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("spec 0018: changelog page", () => {
  test("AC-1: the footer link opens it without signing in; entries come newest first with dates", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("contentinfo").getByRole("link", { name: "Changelog" }).click();
    await expect(page).toHaveURL(/\/en\/changelog$/);
    await expect(page).toHaveTitle("Changelog");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Changelog");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Pages, feedback and stamp dates",
      "Stages and the route planner",
      "First version",
    ]);
    const times = page.locator("time");
    expect(await times.evaluateAll((els) => els.map((e) => e.getAttribute("datetime")))).toEqual([
      "2026-10-02",
      "2026-10-01",
      "2026-09-29",
    ]);
    await expect(times.first()).toHaveText("October 2, 2026");
  });

  test("AC-2: each change carries a translated kind label", async ({ page }) => {
    await page.goto("/en/changelog");
    const newest = page.getByRole("article").first();
    for (const kind of ["New", "Improved", "Fixed"]) {
      await expect(newest.getByText(kind, { exact: true }).first()).toBeVisible();
    }
    await expect(newest.getByText("Account settings, where you can delete your account and all your stamps.")).toBeVisible();
    await expect(page.getByRole("article").nth(2).getByText("Sign in with Google.")).toBeVisible();
  });

  test("AC-3: Russian and Hungarian show their own text, dates and labels", async ({ page }) => {
    await page.goto("/ru/changelog");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("История изменений");
    await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText("Страницы, обратная связь и даты печатей");
    await expect(page.locator("time").first()).toContainText("октября");
    await expect(page.getByText("Исправлено", { exact: true })).toBeVisible();

    await page.goto("/hu/changelog");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Változások");
    await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText("Oldalak, visszajelzés és bélyegzési dátumok");
    await expect(page.locator("time").first()).toContainText("október");
    await expect(page.getByText("Javítás", { exact: true })).toBeVisible();
  });

  test("AC-1: fits a phone screen without horizontal scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    for (const locale of ["hu", "ru"]) {
      await page.goto(`/${locale}/changelog`);
      expect(await noHorizontalScroll(page), locale).toBeLessThanOrEqual(0);
    }
  });
});
