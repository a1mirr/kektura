import { expect, test } from "@playwright/test";

test.describe("spec 0019: useful links page", () => {
  test("AC-1: the footer link opens it without signing in, grouped, with an intro", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("contentinfo").getByRole("link", { name: "Useful links" }).click();
    await expect(page).toHaveURL(/\/en\/links$/);
    await expect(page).toHaveTitle("Useful links");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Useful links");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["The trail", "Planning a hike", "Community and data"]);
    await expect(page.getByText("lead to websites that aren't ours")).toBeVisible();
  });

  test("AC-2: each link has its name as the link and a description after it", async ({ page }) => {
    await page.goto("/en/links");
    const official = page.getByRole("link", { name: "kektura.hu", exact: true });
    await expect(official).toHaveAttribute("href", "https://www.kektura.hu");
    await expect(page.getByText("The official website of the Országos Kéktúra.")).toBeVisible();
    const planning = page.getByRole("region", { name: "Planning a hike" });
    await expect(planning.getByRole("link")).toHaveText(["menetrendek.hu", "met.hu", "turistautak.hu", "OpenStreetMap"]);
    await expect(planning.getByText("HungaroMet, the national weather service: forecasts and warnings.")).toBeVisible();
  });

  test("AC-3: all 11 links are https and open safely in a new tab", async ({ page }) => {
    await page.goto("/en/links");
    const links = page.getByRole("main").getByRole("link");
    await expect(links).toHaveCount(11);
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute("href", /^https:\/\//);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
    }
  });

});
