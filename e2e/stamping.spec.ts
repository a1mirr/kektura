import { expect, test } from "@playwright/test";
import { expandAllStages, measureDescriptions, signInAsNewUser, stat } from "./helpers";

const place = (page: import("@playwright/test").Page, key: string) => page.locator(`#place-${key}`);

test.describe("spec 0001 + 0002: stamping on the dashboard", () => {
  test("0002 AC-3, AC-4 + 0001 AC-3, AC-4: neighbouring stamps walk the stretch between them, persist, and can be removed", async ({
    page,
  }) => {
    await signInAsNewUser(page);
    await expandAllStages(page);

    await place(page, "OKTPH_01_DDKPH_01").getByRole("button", { name: "Add stamp" }).click(); // Írott-kő
    await expect(stat(page, "Stamps")).toHaveText("1 / 161");
    await expect(stat(page, "Kilometres")).toHaveText("0"); // one place alone walks nothing

    await place(page, "OKTPH_02").getByRole("button", { name: "Add stamp" }).click(); // Hét-forrás, km 8.1
    await expect(stat(page, "Stamps")).toHaveText("2 / 161");
    await expect(stat(page, "Kilometres")).toHaveText("8.1");

    await page.reload();
    await expect(stat(page, "Kilometres")).toHaveText("8.1");

    await expandAllStages(page);
    await place(page, "OKTPH_02").getByRole("button", { name: "Remove" }).click();
    await expect(stat(page, "Stamps")).toHaveText("1 / 161");
    await expect(stat(page, "Kilometres")).toHaveText("0");
  });

  test("0001 AC-7: stamping a stage includes its starting point; clearing it keeps the start", async ({ page }) => {
    await signInAsNewUser(page);
    await expandAllStages(page);
    const stage2 = page.locator("#stage-2"); // Sárvár -> Sümeg: 9 own places, starts at Sárvár (1.9)

    await stage2.getByRole("button", { name: "Stamp stage" }).click();
    await expect(stat(page, "Stamps")).toHaveText("10 / 161");
    await expect(stat(page, "Kilometres")).toHaveText("72.4");
    await expect(stage2.locator("[aria-expanded]")).toContainText("9/9");

    await stage2.getByRole("button", { name: "Clear stage" }).click();
    await expect(stat(page, "Stamps")).toHaveText("1 / 161");
    await expect(place(page, "OKTPH_09").getByRole("button", { name: "Remove" })).toBeVisible(); // Sárvár stays
  });

  test("0001 AC-10: stamp descriptions wrap in full: nothing is clipped or sticks out of its row at 375 px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await signInAsNewUser(page);
    await expandAllStages(page);

    const { measured, clipped } = await measureDescriptions(page);
    expect(measured).toBeGreaterThan(200); // 161 places (220 stamps) + 72 extra stamps
    expect(clipped).toEqual([]);
  });

  test("0033 AC-1: stamp descriptions follow the page language, the Hungarian original stays in hu", async ({ page }) => {
    await signInAsNewUser(page);
    const expected = {
      // a place (Piliscsaba) and the first extra stamp (Velem, 3.8 km)
      en: ["Piliscsaba - At the junction of Wesselényi, Árpád vezér and Kálmán király streets, on an electricity pole. (OKTPH_66)", "At the Szent Vid chapel."],
      ru: ["Piliscsaba - На пересечении улиц Wesselényi, Árpád vezér и Kálmán király, на электрическом столбе. (OKTPH_66)", "У часовни Szent Vid."],
      hu: ["Piliscsaba - A Wesselényi-, Árpád vezér- és Kálmán király utca találkozásánál, egy villanyoszlopon. (OKTPH_66)", "A Szent Vid-kápolnánál."],
    };
    for (const [locale, [placeText, extraText]] of Object.entries(expected)) {
      await page.goto(`/${locale}/dashboard`);
      await expect(place(page, "OKTPH_66")).toContainText(placeText);
      await expect(page.locator("#extra-stamps li").first()).toContainText(extraText);
    }
  });

  test("0001 AC-11: the dashboard never scrolls sideways at 375 px: collapsed, expanded and with stamped rows, in every language", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await signInAsNewUser(page);
    const locales = ["en", "hu", "ru"];
    const widths = () =>
      page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
    const expectFits = async (label: string, stagesOpen: boolean) => {
      for (const locale of locales) {
        await page.goto(`/${locale}/dashboard`);
        await expect(page.locator("#extra-stamps li").first()).toBeVisible();
        // Stages open after mount, from what the browser remembers: measure only once they are in the wanted state.
        await expect(page.locator("#stage-1 [aria-expanded]")).toHaveAttribute("aria-expanded", String(stagesOpen));
        const { scroll, viewport } = await widths();
        expect(scroll, `${locale}, ${label}`).toBeLessThanOrEqual(viewport);
      }
    };

    await expectFits("every stage collapsed", false);

    // A date field next to the buttons is the widest a row gets: stamp a place and an extra stamp.
    await page.goto("/en/dashboard");
    await expandAllStages(page);
    await place(page, "OKTPH_01_DDKPH_01").getByRole("button", { name: "Add stamp" }).click();
    await page.locator("#extra-stamps li").first().getByRole("button", { name: "Add stamp" }).click();
    await expect(place(page, "OKTPH_01_DDKPH_01").locator("input[type=date]")).toBeVisible();
    await expect(page.locator("#extra-stamps li").first().locator("input[type=date]")).toBeVisible();

    await expectFits("stamped rows, every stage expanded", true); // the open stages are remembered across languages
  });
});
