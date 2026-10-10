import { expect, test, type Page } from "@playwright/test";
import { expandAllStages, signInAsNewUser, stat } from "./helpers";
import { psql } from "./local-db";

// Nyírjesi-erdészház retired on 2014-11-21 (Vércverés replaced it); it followed Galyatető (OKTPH_102) in stage 20.
const RETIRED = "OKT_RETIRED_NYIRJESI";
const row = (page: Page) => page.locator(`#place-${RETIRED}`);
const stampGalyatetoOn = (email: string, day: string) =>
  psql(
    `insert into public.user_stamps (user_id, checkpoint_id, stamped_on) select u.id, c.id, '${day}' from auth.users u, public.checkpoints c where u.email = '${email}' and c.place_key = 'OKTPH_102'`,
  );
const userId = (email: string) => psql(`select id from auth.users where email = '${email}'`);
const retiredStampsOf = (email: string) =>
  psql(
    `select count(*) from public.user_stamps s join auth.users u on u.id = s.user_id join public.checkpoints c on c.id = s.checkpoint_id where u.email = '${email}' and c.code = '${RETIRED}'`,
  );

test.describe("spec 0001: retired stamps", () => {
  test("AC-23, AC-24, AC-26: hidden until asked for, with a note that says what it was and what replaced it; the choice is remembered", async ({ page }) => {
    await signInAsNewUser(page);
    await expandAllStages(page);
    await expect(row(page)).toBeHidden();
    await expect(page.locator("#place-OKTPH_103")).toContainText("Replaces the retired stamp Nyírjesi-erdészház (valid until November 20, 2014).");

    await page.getByLabel("Show retired stamps").check();
    await expect(row(page)).toBeVisible();
    await expect(row(page)).toContainText("Nyírjesi-erdészház");
    await expect(row(page)).toContainText("retired");
    await expect(row(page)).toContainText("Retired stamp: valid until November 20, 2014. Replaced by Vércverés.");
    await expect(row(page)).toContainText("Its position in the list is approximate.");
    await expect(row(page).getByRole("link", { name: "Vércverés" })).toHaveAttribute("href", "#place-OKTPH_103");
    await expect(stat(page, "Stamps")).toHaveText("0 / 161");

    await page.reload();
    await expandAllStages(page);
    await expect(page.getByLabel("Show retired stamps")).toBeChecked();
    await expect(row(page)).toBeVisible();
    await page.getByLabel("Show retired stamps").uncheck();
    await expect(row(page)).toBeHidden();
  });

  test("AC-23: it is listed for somebody who walked past it before it retired, and not for somebody who walked past after", async ({ page, browser }) => {
    const before = await signInAsNewUser(page);
    stampGalyatetoOn(before, "2014-06-01");
    await page.goto("/en/dashboard");
    await expandAllStages(page);
    await expect(row(page)).toBeVisible();

    const otherPage = await (await browser.newContext()).newPage();
    const after = await signInAsNewUser(otherPage);
    stampGalyatetoOn(after, "2015-06-01");
    await otherPage.goto("/en/dashboard");
    await expandAllStages(otherPage);
    await expect(row(otherPage)).toBeHidden();
    await otherPage.context().close();
  });

  test("AC-25: collecting it takes a day before it retired; it counts for nothing but its own line, and a stage button does not touch it", async ({ page }) => {
    const email = await signInAsNewUser(page);
    await expandAllStages(page);
    await page.getByLabel("Show retired stamps").check();
    const add = row(page).getByRole("button", { name: "Add retired stamp Nyírjesi-erdészház" });
    const field = row(page).getByLabel(/Date you collected it, by November 20, 2014/);

    await expect(add).toBeDisabled();
    await field.fill("2014-11-21");
    await expect(add).toBeDisabled();
    await field.fill("2026-10-05");
    await expect(add).toBeDisabled();
    await field.fill("2014-06-01");
    await expect(add).toBeEnabled();
    await add.click();

    await expect(row(page).getByLabel("Date of the stamp")).toHaveValue("2014-06-01");
    await expect(row(page).getByRole("button", { name: "Remove retired stamp Nyírjesi-erdészház" })).toBeVisible();
    await expect(stat(page, "Stamps")).toHaveText("0 / 161");
    await expect(stat(page, "Kilometres")).toHaveText("0");
    const stage = page.locator("#stage-20");
    await expect(stage).toContainText("Retired stamps collected: 1");
    await expect(stage.locator("[aria-expanded]").first()).toContainText("+1 retired");
    await expect(stage.locator("[aria-expanded]").first()).toContainText("0/6");
    expect(retiredStampsOf(email)).toBe("1");

    await stage.getByRole("button", { name: "Stamp stage" }).click();
    await expect(stat(page, "Stamps")).toHaveText("7 / 161"); // 6 own places and the starting point
    await expect(stage.locator("[aria-expanded]").first()).toContainText("6/6");
    await stage.getByRole("button", { name: "Clear stage" }).click();
    await expect(stat(page, "Stamps")).toHaveText("1 / 161");
    expect(retiredStampsOf(email)).toBe("1");

    await row(page).getByRole("button", { name: "Remove retired stamp Nyírjesi-erdészház" }).click();
    await expect(stage).not.toContainText("Retired stamps collected");
    expect(retiredStampsOf(email)).toBe("0");
  });

  test("AC-25: a retired stamp the user already holds is listed whatever the toggle says, and keeps listing when they walked after it retired", async ({ page }) => {
    const email = await signInAsNewUser(page);
    psql(
      `insert into public.user_stamps (user_id, checkpoint_id, stamped_on) select u.id, c.id, '2013-05-05' from auth.users u, public.checkpoints c where u.email = '${email}' and c.code = '${RETIRED}'`,
    );
    stampGalyatetoOn(email, "2020-01-01"); // walked after it retired: the rule alone would not list it
    await page.goto("/en/dashboard");
    await expandAllStages(page);
    await expect(row(page)).toBeVisible();
    await expect(row(page).getByLabel("Date of the stamp")).toHaveValue("2013-05-05");
    await expect(stat(page, "Stamps")).toHaveText("1 / 161");
  });

  test("AC-26 + spec 0024 AC-26: a friend's page lists no retired stamp and counts none", async ({ page, browser }) => {
    const viewer = await signInAsNewUser(page);
    const friendPage = await (await browser.newContext()).newPage();
    const friend = await signInAsNewUser(friendPage);
    psql(
      `insert into public.user_stamps (user_id, checkpoint_id, stamped_on) select u.id, c.id, '2013-05-05' from auth.users u, public.checkpoints c where u.email = '${friend}' and c.code = '${RETIRED}'`,
    );
    psql(
      `insert into public.friendships (user_id, friend_id, status, user_is_sharing, friend_is_sharing) values ('${userId(viewer)}', '${userId(friend)}', 'accepted', true, true)`,
    );
    await page.goto(`/en/friends/${userId(friend)}`);
    await expect(stat(page, "Stamps")).toHaveText("0 / 161");
    await expect(page.locator(`#place-${RETIRED}`)).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText("Nyírjesi");
    await friendPage.context().close();
  });

  for (const width of [375]) {
    test(`AC-27: the note, badge and date field wrap and never widen the page at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await signInAsNewUser(page);
      await page.goto("/en/dashboard");
      await expandAllStages(page);
      await page.getByLabel("Show retired stamps").check();
      for (const locale of ["en", "hu", "de", "ru"]) {
        await page.goto(`/${locale}/dashboard`);
        await expect(row(page)).toBeVisible();
        const { scroll, viewport } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
        expect(scroll, locale).toBeLessThanOrEqual(viewport);
        const [li, text, controls] = await Promise.all([row(page).boundingBox(), row(page).locator("> div").first().boundingBox(), row(page).locator("> div").nth(1).boundingBox()]);
        expect(text!.x + text!.width, `${locale}: the text stays in its row`).toBeLessThanOrEqual(li!.x + li!.width + 1);
        expect(controls!.x + controls!.width, `${locale}: the controls stay in the row`).toBeLessThanOrEqual(li!.x + li!.width + 1);
      }
    });
  }
});
