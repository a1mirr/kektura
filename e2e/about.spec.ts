import { expect, test } from "@playwright/test";

test.describe("spec 0015: about page", () => {
  test("AC-1: the footer link opens it without signing in, with its own title", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("contentinfo").getByRole("link", { name: "About" }).click();
    await expect(page).toHaveURL(/\/en\/about$/);
    await expect(page).toHaveTitle("About Kéktúra tracker");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("About Kéktúra tracker");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "The trail in numbers",
      "How your progress is counted",
      "Data and credits",
      "Your data",
      "Questions or ideas?",
    ]);
  });

  test("AC-2: the trail in numbers comes from the stage table", async ({ page }) => {
    await page.goto("/en/about");
    const fact = (label: string) => page.locator("dl > div", { has: page.getByText(label, { exact: true }) }).locator("dd");
    await expect(fact("Stages")).toHaveText("27");
    await expect(fact("Official stamping places")).toHaveText("161");
    await expect(fact("Kilometres (MTSZ table)")).toHaveText("1,183.1");
  });

  test("AC-3: explains the progress rule in four points", async ({ page }) => {
    await page.goto("/en/about");
    const points = page.getByRole("region", { name: "How your progress is counted" }).getByRole("listitem");
    await expect(points).toHaveCount(4);
    await expect(points.nth(1)).toContainText("only when both of its stamps are collected");
  });

  test("AC-4: every source link is https and opens safely in a new tab", async ({ page }) => {
    await page.goto("/en/about");
    const links = page.getByRole("region", { name: "Data and credits" }).getByRole("link");
    await expect(links).toHaveCount(4);
    for (const l of await links.all()) {
      await expect(l).toHaveAttribute("href", /^https:\/\//);
      await expect(l).toHaveAttribute("target", "_blank");
      await expect(l).toHaveAttribute("rel", /noopener/);
    }
    await expect(page.getByText("not affiliated with MTSZ")).toBeVisible();
  });

  test("AC-5, AC-8: 'Your data' links to the account page, and the page links to the feedback form", async ({ page }) => {
    await page.goto("/en/about");
    await expect(page.getByRole("region", { name: "Your data" }).getByRole("link", { name: "Account", exact: true })).toHaveAttribute(
      "href",
      "/en/account",
    );
    await page.getByRole("link", { name: "feedback form" }).click();
    await expect(page).toHaveURL(/\/en\/feedback$/);
  });

  test("AC-1, AC-7: Russian and Hungarian versions exist and keep the layout", async ({ page }) => {
    await page.goto("/ru/about");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("О трекере Kéktúra");
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(5);

    await page.goto("/hu/about");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("A Kéktúra követőről");
    await expect(page.locator("html")).toHaveAttribute("lang", "hu");
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(5);

    await page.goto("/de/about");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Über den Kéktúra-Tracker");
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(5);
  });

  test("AC-1: fits a phone screen without horizontal scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/hu/about"); // the language with the longest words
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
