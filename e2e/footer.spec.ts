import { expect, test } from "@playwright/test";
import { signInAsNewUser } from "./helpers";

test.describe("spec 0014: footer", () => {
  test("AC-1: a public page has links to the four pages, and none to the account settings", async ({ page }) => {
    await page.goto("/en");
    const footer = page.getByRole("contentinfo");
    const links = footer.getByRole("link");
    await expect(links).toHaveText(["About", "Changelog", "Useful links", "Feedback"]);
    expect(await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")))).toEqual([
      "/en/about",
      "/en/changelog",
      "/en/links",
      "/en/feedback",
    ]);
    await expect(footer.getByText(/settings/i)).toHaveCount(0);
  });

  test("AC-1: the footer is also on the dashboard, in the page's language", async ({ page }) => {
    await signInAsNewUser(page);
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Feedback" })).toBeVisible();
    await page.goto("/ru");
    await page.goto("/ru/about");
    await expect(page.getByRole("contentinfo").getByRole("link")).toHaveText([
      "О приложении",
      "История изменений",
      "Полезные ссылки",
      "Обратная связь",
    ]);
    await page.goto("/hu/about");
    await expect(page.getByRole("contentinfo").getByRole("link")).toHaveText([
      "Névjegy",
      "Változások",
      "Hasznos linkek",
      "Visszajelzés",
    ]);
  });
});
