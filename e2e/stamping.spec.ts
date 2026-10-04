import { expect, test } from "@playwright/test";
import { expandAllStages, measureDescriptions, signInAsNewUser, stat } from "./helpers";
import { psql } from "./local-db";

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
      de: ["Piliscsaba - An der Kreuzung der Wesselényi-, Árpád-vezér- und Kálmán-király-Straße, an einem Strommast. (OKTPH_66)", "An der Kapelle Szent Vid."],
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
    const locales = ["en", "hu", "ru", "de"];
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

    // A date field with its calendar button next to the buttons is the widest a row gets: stamp a place and an extra stamp.
    await page.goto("/en/dashboard");
    await expandAllStages(page);
    await place(page, "OKTPH_01_DDKPH_01").getByRole("button", { name: "Add stamp" }).click();
    await page.locator("#extra-stamps li").first().getByRole("button", { name: "Add stamp" }).click();
    await expect(place(page, "OKTPH_01_DDKPH_01").getByRole("button", { name: "Open calendar" })).toBeVisible();
    await expect(page.locator("#extra-stamps li").first().getByRole("button", { name: "Open calendar" })).toBeVisible();

    await expectFits("stamped rows, every stage expanded", true); // the open stages are remembered across languages
  });

  test("0002 AC-9, AC-13, AC-14: the button flips and is disabled at once, the stats and the date field wait for the server's answer", async ({
    page,
  }) => {
    await signInAsNewUser(page);
    await expandAllStages(page);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    // Server actions are POSTs to the page: hold the answer back.
    await page.route("**/en/dashboard", async (route) => {
      if (route.request().method() === "POST") await gate;
      await route.continue();
    });

    const row = place(page, "OKTPH_02");
    await row.getByRole("button", { name: "Add stamp" }).click();
    const undo = row.getByRole("button", { name: "Remove" });
    await expect(undo).toBeVisible(); // flipped at once (optimistic) ...
    await expect(undo).toBeDisabled(); // ... and disabled while the action runs
    await expect(row.getByLabel("Date of the stamp")).toHaveCount(0); // the date is the server's
    await expect(stat(page, "Stamps")).toHaveText("0 / 161"); // no optimistic maths

    release();
    await expect(row.getByLabel("Date of the stamp")).toBeVisible();
    await expect(undo).toBeEnabled();
    await expect(stat(page, "Stamps")).toHaveText("1 / 161");
  });

  test("0001 AC-11: at 375 px a stamped row's controls wrap onto their own line under the text, right-aligned", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await signInAsNewUser(page);
    await expandAllStages(page);
    const row = place(page, "OKTPH_02");
    await row.getByRole("button", { name: "Add stamp" }).click();
    await expect(row.getByLabel("Date of the stamp")).toBeVisible();

    const [li, text, controls] = await Promise.all([
      row.boundingBox(),
      row.locator("> div").first().boundingBox(),
      row.locator("> div").nth(1).boundingBox(),
    ]);
    expect(controls!.y, "the controls start below the text").toBeGreaterThanOrEqual(text!.y + text!.height - 1);
    const gapToRight = li!.x + li!.width - (controls!.x + controls!.width);
    expect(gapToRight, "the controls end at the row's right padding").toBeLessThanOrEqual(20);
    expect(gapToRight).toBeGreaterThanOrEqual(0);
  });

  test("0002 AC-15: after the first load, stamping and reloading hardly read the reference data from the database again", async ({
    page,
  }) => {
    await signInAsNewUser(page);
    await page.reload(); // makes sure the shared cache has been filled by now
    // extra_stamps is read by the dashboard's reference data only, never by an action: its read counter
    // moves only when the cache misses (one read = the 72 rows).
    const reads = async () => {
      await page.waitForTimeout(1_500); // the database publishes its counters with a short delay
      return Number(psql("select seq_tup_read + coalesce(idx_tup_fetch, 0) from pg_stat_user_tables where relname = 'extra_stamps'"));
    };
    const before = await reads();
    await expandAllStages(page);
    for (const key of ["OKTPH_02", "OKTPH_03", "OKTPH_04", "OKTPH_05"]) {
      await place(page, key).getByRole("button", { name: "Add stamp" }).click();
      await expect(place(page, key).getByLabel("Date of the stamp")).toBeVisible();
    }
    for (let i = 0; i < 4; i++) await page.reload();
    await expect(stat(page, "Stamps")).toHaveText("4 / 161");
    // Eight renders without the cache would read 8 x 72 rows; a cold start of the whole suite can fill the cache
    // a couple of times (parallel workers), which is why up to three fills are allowed.
    expect((await reads()) - before).toBeLessThanOrEqual(3 * 72);
  });
});
