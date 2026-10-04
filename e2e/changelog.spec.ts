import { expect, test } from "@playwright/test";
import { CHANGELOG } from "../src/content/changelog";

// The expectations come from the data the page renders, so adding an entry on top (spec 0018 AC-7)
// doesn't break them; what they check is that the page shows that data in order and in each language.
const longDate = (locale: string, date: string) =>
  new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
const newest = CHANGELOG[0];

test.describe("spec 0018: changelog page", () => {
  test("AC-1: the footer link opens it without signing in; entries come newest first with dates", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("contentinfo").getByRole("link", { name: "Changelog" }).click();
    await expect(page).toHaveURL(/\/en\/changelog$/);
    await expect(page).toHaveTitle("Changelog");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Changelog");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(CHANGELOG.map((e) => e.title.en));
    const times = page.locator("time");
    expect(await times.evaluateAll((els) => els.map((e) => e.getAttribute("datetime")))).toEqual(CHANGELOG.map((e) => e.date));
    await expect(times.first()).toHaveText(longDate("en", newest.date));
  });

  test("AC-2: each change carries a translated kind label", async ({ page }) => {
    await page.goto("/en/changelog");
    const labels = { new: "New", improved: "Improved", fixed: "Fixed" };
    // Every kind that any entry uses, so a wrong label still shows when the newest entry has only one kind.
    for (const kind of new Set(CHANGELOG.flatMap((e) => e.changes.map((c) => c.kind)))) {
      await expect(page.getByText(labels[kind], { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByRole("article").first().getByText(newest.changes[0].text.en, { exact: true })).toBeVisible();
    // The oldest entry is the first version (AC-6).
    await expect(page.getByRole("article").last().getByText("Sign in with Google.")).toBeVisible();
  });

});
