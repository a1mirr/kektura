import { expect, test } from "@playwright/test";
import { expandAllStages, signInAsNewUser, stat } from "./helpers";
import { psql } from "./local-db";

// Vércverés (OKTPH_103, stage 20) is required from 2014-11-21; its neighbours on the trail are Galyatető (OKTPH_102)
// and Vörösmarty fogadó (OKTPH_104).
const stampNeighbours = (email: string, day: string) =>
  psql(
    `insert into public.user_stamps (user_id, checkpoint_id, stamped_on) select u.id, c.id, '${day}' from auth.users u, public.checkpoints c where u.email = '${email}' and c.place_key in ('OKTPH_102', 'OKTPH_104')`,
  );
const kmBetweenNeighbours = () =>
  psql(
    "select round(((select max(km_from_start) from public.checkpoints where place_key = 'OKTPH_104') - (select max(km_from_start) from public.checkpoints where place_key = 'OKTPH_102'))::numeric, 1)",
  );

test.describe("spec 0001: stamps required from a date", () => {
  test("AC-17, AC-18, AC-19, AC-20: a user who walked past before the date is not missing the stamp, and the stretch counts", async ({ page }) => {
    const email = await signInAsNewUser(page);
    stampNeighbours(email, "2014-06-01");
    await page.goto("/en/dashboard");
    await expandAllStages(page);

    const row = page.locator("#place-OKTPH_103");
    await expect(row).toContainText("Stamp required from November 21, 2014");
    await expect(row).toContainText("Not required for your walk");
    await expect(row.getByRole("button", { name: "Add stamp" })).toBeVisible(); // still unstamped, only not missing
    await expect(stat(page, "Stamps")).toHaveText("2 / 161"); // the waived place is not a stamp
    await expect(stat(page, "Kilometres")).toHaveText(kmBetweenNeighbours()); // the stretch across it is walked
    const stage = page.locator("#stage-20"); // Mátraverebély -> Mátraháza: 6 places, 2 stamped, Vércverés waived
    await expect(stage.locator("[aria-expanded]").first()).toContainText("3/6"); // the waived place is done for the stage's progress
    await expect(stage.getByRole("button", { name: "Stamp stage" })).toBeVisible(); // but the button follows the stamps

    // The date explains itself, by click (and so by keyboard and touch).
    const why = row.getByText(/became required on that day/);
    await expect(why).toBeHidden();
    await row.getByRole("button", { name: /November 21, 2014/ }).click();
    await expect(why).toBeVisible();
    await expect(why).not.toContainText("tolerance"); // an announcement of 2014 says nothing of one

    // A later stamp takes nothing away.
    await row.getByRole("button", { name: "Add stamp" }).click();
    await expect(stat(page, "Stamps")).toHaveText("3 / 161");
    await expect(stat(page, "Kilometres")).toHaveText(kmBetweenNeighbours());
  });

  test("AC-17: a user who walked it after the date needs the stamp: the stretch is not walked until it is stamped", async ({ page }) => {
    const email = await signInAsNewUser(page);
    stampNeighbours(email, "2026-01-01");
    await page.goto("/en/dashboard");
    await expandAllStages(page);

    const row = page.locator("#place-OKTPH_103");
    await expect(row).toContainText("Stamp required from November 21, 2014");
    await expect(row).not.toContainText("Not required for your walk");
    await expect(stat(page, "Stamps")).toHaveText("2 / 161");
    await expect(stat(page, "Kilometres")).toHaveText("0");
    await row.getByRole("button", { name: "Add stamp" }).click();
    await expect(stat(page, "Kilometres")).toHaveText(kmBetweenNeighbours());
  });

  test("AC-19, AC-20: a friend's page shows the date and the waiver as theirs, with their figures", async ({ page, browser }) => {
    // The viewer and a friend who shares with them: an accepted friendship made in the database (the invite flow is spec 0024's).
    const viewer = await signInAsNewUser(page);
    const friendPage = await (await browser.newContext()).newPage();
    const friend = await signInAsNewUser(friendPage);
    stampNeighbours(friend, "2014-06-01");
    const id = (email: string) => psql(`select id from auth.users where email = '${email}'`);
    psql(
      `insert into public.friendships (user_id, friend_id, status, user_is_sharing, friend_is_sharing) values ('${id(viewer)}', '${id(friend)}', 'accepted', true, true)`,
    );

    await page.goto(`/en/friends/${id(friend)}`);
    await expect(stat(page, "Stamps")).toHaveText("2 / 161"); // the waived place is no stamp
    await expect(stat(page, "Kilometres")).toHaveText(kmBetweenNeighbours()); // the stretch across it is walked
    const row = page.locator("#place-OKTPH_103");
    await expect(row).toContainText("Stamp required from November 21, 2014");
    await expect(row).toContainText("Not required for their walk");
    await expect(row).not.toContainText("Not required for your walk");
    await friendPage.context().close();
  });

  test("AC-19: a stamp the MTSZ announced a tolerance for says so in its explanation", async ({ page }) => {
    await signInAsNewUser(page);
    await page.goto("/en/dashboard");
    await expandAllStages(page);
    const row = page.locator("#place-OKTPH_30_B"); // Badacsony, required from 2025-05-08
    await row.getByRole("button", { name: /May 8, 2025/ }).click();
    await expect(row.getByText(/one-month tolerance/)).toBeVisible();
  });

  for (const width of [375]) {
    test(`AC-21: the date, hint and explanation wrap and never widen the page at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      const email = await signInAsNewUser(page);
      stampNeighbours(email, "2014-06-01");
      await page.goto("/en/dashboard");
      await expandAllStages(page); // the open stages are remembered across languages
      for (const locale of ["en", "de"]) {
        await page.goto(`/${locale}/dashboard`);
        await expect(page.locator("#stage-1 [aria-expanded]")).toHaveAttribute("aria-expanded", "true");
        const row = page.locator("#place-OKTPH_103");
        await row.locator("button[aria-expanded]").click();
        await expect(row.locator("p[id]")).toBeVisible();
        const { scroll, viewport } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
        expect(scroll, locale).toBeLessThanOrEqual(viewport);
        const [li, text] = await Promise.all([row.boundingBox(), row.locator("> div").first().boundingBox()]);
        expect(text!.x + text!.width, `${locale}: the text stays in its row`).toBeLessThanOrEqual(li!.x + li!.width + 1);
      }
    });
  }
});
