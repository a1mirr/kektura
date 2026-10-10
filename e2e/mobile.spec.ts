import { randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { accountButton, expandAllStages, expectNoSidewaysScroll, openAccountMenu, openStampPopup, seedStatsWalk, signInAsNewUser, stampPlacesOn, stat } from "./helpers";
import { psql } from "./local-db";

// The control is on the screen: visible, inside the window sideways, and big enough to hit with a thumb: at least 24 px
// each way (WCAG 2.2's target size), or `minSize` where a spec promises more (44 px).
async function expectTappable(page: Page, control: Locator, what: string, minSize = 24) {
  await expect(control, `${what} is visible`).toBeVisible();
  await control.scrollIntoViewIfNeeded();
  const box = (await control.boundingBox())!;
  const width = await page.evaluate(() => document.documentElement.clientWidth);
  expect(box.x, `${what} starts inside the window`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${what} ends inside the window`).toBeLessThanOrEqual(width + 0.5);
  expect(Math.min(box.width, box.height), `${what} is big enough to tap`).toBeGreaterThanOrEqual(minSize);
  await expect(control, `${what} is enabled`).toBeEnabled();
}

test.describe("spec 0006: the pages at a phone's width", { tag: "@mobile" }, () => {
  test("AC-10: the phone project is a 375 px touch screen", async ({ page }) => {
    await page.goto("/en");
    expect(await page.evaluate(() => [window.innerWidth, navigator.maxTouchPoints > 0, matchMedia("(pointer: coarse)").matches])).toEqual([
      375,
      true,
      true,
    ]);
  });

  test("AC-10: the landing page does not scroll sideways, and the dummy sign-in works with a tap", async ({ page }) => {
    await page.goto("/en");
    await expectNoSidewaysScroll(page, "sideways scroll on the landing page");
    const email = page.getByLabel(/^Test login/);
    const button = page.getByRole("button", { name: "Sign in as test user" });
    await expectTappable(page, email, "the email field");
    await expectTappable(page, button, "the sign-in button");
    await email.fill(`e2e-${randomUUID()}@kektura.test`);
    await button.tap();
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    await expect(stat(page, "Stamps")).toHaveText("0 / 161");
    await expectNoSidewaysScroll(page, "sideways scroll on the dashboard after signing in");
  });

  test("AC-10: the dashboard does not scroll sideways, and a place is stamped and unstamped with a tap", async ({ page }) => {
    await signInAsNewUser(page);
    await expandAllStages(page);
    const row = page.locator("#place-OKTPH_02");
    const add = row.getByRole("button", { name: "Add stamp" });
    await expectTappable(page, add, "the stamp button");
    await add.tap();
    await expect(stat(page, "Stamps")).toHaveText("1 / 161");
    const remove = row.getByRole("button", { name: "Remove" });
    await expectTappable(page, remove, "the remove button");
    await expectNoSidewaysScroll(page, "sideways scroll on the dashboard with a stamped row");
    await remove.tap();
    await expect(stat(page, "Stamps")).toHaveText("0 / 161");
  });

  test("AC-10: the stage list does not scroll sideways, and a stage opens and closes with a tap", async ({ page }) => {
    await signInAsNewUser(page);
    await expectNoSidewaysScroll(page, "sideways scroll on the collapsed stage list");
    const toggle = page.locator("#stage-1 [aria-expanded]");
    await expectTappable(page, toggle, "the stage's heading button");
    // Retried until it sticks: the first tap can come before hydration.
    await expect(async () => {
      await toggle.tap();
      await expect(toggle).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
    }).toPass();
    await expectNoSidewaysScroll(page, "sideways scroll on an open stage");
    await expandAllStages(page);
    await expectNoSidewaysScroll(page, "sideways scroll on the whole stage list");
    await toggle.tap();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("AC-10: the map does not scroll the page sideways, and fullscreen is entered and left with a tap", async ({ page }) => {
    await signInAsNewUser(page);
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    await expectNoSidewaysScroll(page, "sideways scroll with the map");
    const enter = page.getByRole("button", { name: "Fullscreen", exact: true });
    await expectTappable(page, enter, "the fullscreen button");
    await enter.tap();
    const leave = page.getByRole("button", { name: "Exit fullscreen" });
    await expectTappable(page, leave, "the exit-fullscreen button");
    await expectNoSidewaysScroll(page, "sideways scroll with the map in fullscreen");
    await leave.tap();
    await expect(enter).toBeVisible();
  });

  test("AC-10: a stamp's popup fits at 375 px and its report link is a target of at least 44 px", async ({ page }) => {
    await signInAsNewUser(page);
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expandAllStages(page);
    await openStampPopup(page, "OKTPH_84_B", "Mark as walked");
    const link = page.locator(".maplibregl-popup").getByRole("link", { name: "Report a wrong location" });
    await expectTappable(page, link, "the report link", 44);
    await expect(link).toHaveAttribute("href", "/en/feedback?stamp=OKTPH_84_B");
    await expectNoSidewaysScroll(page, "sideways scroll with a stamp's popup open");
  });

  test("AC-10: the friends page does not scroll sideways, and the name is saved with a tap", async ({ page }) => {
    await signInAsNewUser(page);
    await page.goto("/en/friends");
    await expectNoSidewaysScroll(page, "sideways scroll on the Friends page");
    const name = page.getByLabel(/^Your name/);
    const save = page.getByRole("button", { name: "Save" });
    await expectTappable(page, name, "the name field");
    await expectTappable(page, save, "the save button", 44);
    await expectTappable(page, page.getByLabel("Your invite link"), "the invite link");
    await name.fill("Phone Hiker");
    // Retried until it sticks: a tap before hydration leaves the page as it was.
    await expect(async () => {
      await save.tap();
      await expect(page.getByText("Name saved.")).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await expectNoSidewaysScroll(page, "sideways scroll on the Friends page after saving");
  });

  test("AC-10: the settings page does not scroll sideways, and signing out works with a tap", async ({ page }) => {
    await signInAsNewUser(page);
    await page.goto("/en/account");
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    await expectNoSidewaysScroll(page, "sideways scroll on the settings page");
    const signOut = page.getByRole("button", { name: "Sign out" });
    await expectTappable(page, signOut, "the sign-out button", 44);
    await expectTappable(page, page.getByRole("button", { name: "Delete account" }), "the delete button");
    await signOut.tap();
    await expect(page).toHaveURL(/\/en$/);
  });

  test("AC-10: the account menu opens with a tap, its list stays inside the window and its targets are 44 px, in every language", async ({ page }) => {
    await signInAsNewUser(page);
    for (const locale of ["en", "hu", "de", "ru"]) {
      await page.goto(`/${locale}/dashboard`);
      const button = accountButton(page);
      await expectTappable(page, button, `the account button (${locale})`, 44);
      await expectTappable(page, page.getByLabel(/^(Language|Nyelv|Sprache|Язык)$/), `the language switcher (${locale})`, 44);
      await expectNoSidewaysScroll(page, `sideways scroll with the strip's controls in ${locale}`);
      await expect(button).toHaveAttribute("aria-expanded", "false");
      await button.tap();
      await expect(button).toHaveAttribute("aria-expanded", "true");
      const list = page.locator("body > header details ul");
      const width = await page.evaluate(() => document.documentElement.clientWidth);
      const box = (await list.boundingBox())!;
      expect(box.x, `the list starts inside the window (${locale})`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `the list ends inside the window (${locale})`).toBeLessThanOrEqual(width + 0.5);
      expect(box.width, `the list is at least 200 px wide (${locale})`).toBeGreaterThanOrEqual(200);
      for (const control of await list.locator("a, button").all()) {
        const target = (await control.boundingBox())!;
        expect(Math.min(target.width, target.height), `an entry is a 44 px target (${locale})`).toBeGreaterThanOrEqual(44);
      }
      await expectNoSidewaysScroll(page, `sideways scroll with the menu open in ${locale}`);
    }
    await page.goto("/en/dashboard");
    const menu = await openAccountMenu(page);
    await menu.getByRole("link", { name: "My stats", exact: true }).tap();
    await expect(page).toHaveURL(/\/en\/stats$/);
    await (await openAccountMenu(page)).getByRole("button", { name: "Sign out" }).tap();
    await expect(page).toHaveURL(/\/en$/);
  });

  test("AC-10: the stats page does not scroll sideways, and a month's tooltip is opened and closed with taps", async ({ page }) => {
    const email = await signInAsNewUser(page);
    seedStatsWalk(email);
    stampPlacesOn(email, { OKTPH_06: "2025-01-05" });
    await page.goto("/en/stats");
    await expect(page.locator("[data-month]").first()).toBeAttached();
    await expectNoSidewaysScroll(page, "sideways scroll on the stats page");
    expect(await page.locator("[data-month-chart]").evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);

    const may = page.getByRole("button", { name: /^May 2026:/ });
    await expectTappable(page, may, "the newest month", 44);
    const tooltip = page.locator("[data-chart-tooltip]");
    // Retried until it sticks: a tap before hydration does nothing.
    await expect(async () => {
      await may.tap();
      await expect(tooltip).toContainText("May 2026", { timeout: 1_000 });
    }).toPass();
    await expect(tooltip).toContainText("20.6 km");
    await expectNoSidewaysScroll(page, "sideways scroll on the stats page with a tooltip open");
    const box = (await tooltip.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375.5);
    await may.tap();
    await expect(tooltip).toHaveCount(0);
    const april = page.getByRole("button", { name: /^April 2026:/ });
    await april.tap();
    await expect(tooltip).toContainText("April 2026");
    await page.getByRole("heading", { level: 1 }).tap();
    await expect(tooltip).toHaveCount(0);
  });

  // The bar above a real on-screen keyboard cannot be tested here.
  test("AC-10: Set dates does not scroll sideways, the toolbar and the bar fit at 375 and 320 px, and rows are chosen and dated with taps", async ({ page }) => {
    const email = await signInAsNewUser(page);
    await expandAllStages(page);
    const stamp = (key: string) => page.locator(`#place-${key}`);
    for (const key of ["OKTPH_02", "OKTPH_03"]) {
      await stamp(key).getByRole("button", { name: "Add stamp" }).tap();
      await expect(stamp(key).getByRole("button", { name: "Remove" })).toBeVisible();
    }
    const change = page.getByRole("button", { name: "Set dates" });
    await expectTappable(page, change, "the Set dates button", 36);
    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 700 });
      await expectNoSidewaysScroll(page, `sideways scroll with the toolbar at ${width} px`);
      const at = (await change.boundingBox())!;
      expect(at.x, `the button starts inside the window at ${width} px`).toBeGreaterThanOrEqual(0);
      expect(at.x + at.width, `the button ends inside the window at ${width} px`).toBeLessThanOrEqual(width + 0.5);
    }
    await page.evaluate(() => window.scrollTo(0, 1500));
    await expect(change).not.toBeInViewport();
    await page.evaluate(() => window.scrollTo(0, 1200));
    await expect(change).toBeInViewport();
    await change.tap();
    const bar = page.getByRole("region", { name: "Set the date of several stamps" });
    await expect(bar).toBeVisible();
    await expect(change).toHaveAttribute("aria-pressed", "true");

    await stamp("OKTPH_02").getByRole("checkbox").tap();
    await stamp("OKTPH_03").getByRole("checkbox").tap();
    await stamp("OKTPH_04").getByRole("checkbox").tap();
    await expect(bar.getByRole("status")).toHaveText("3 selected · 1 not stamped yet");
    await bar.getByLabel("New date of the selected stamps").fill("2024-03-05");

    const label = (key: string) => stamp(key).locator("label", { has: page.getByRole("checkbox") });
    await expectTappable(page, label("OKTPH_02"), "the checkbox's label", 44);
    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 700 });
      await expectNoSidewaysScroll(page, `sideways scroll with the bar at ${width} px`);
      const box = (await bar.boundingBox())!;
      expect(box.x, `the bar starts inside the window at ${width} px`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `the bar ends inside the window at ${width} px`).toBeLessThanOrEqual(width + 0.5);
      expect(box.y + box.height, `the bar sits at the bottom of the screen at ${width} px`).toBeGreaterThan(700 - 4);
      for (const name of ["Select all", "Clear", "Cancel", "Apply", "Open calendar"]) {
        await expectTappable(page, bar.getByRole("button", { name }), `the ${name} button`, 44);
      }
      await expectTappable(page, bar.getByLabel("New date of the selected stamps"), "the date field", 44);
    }

    await bar.getByRole("button", { name: "Apply" }).tap();
    await expect(page.getByText("3 dates set")).toBeVisible();
    await expect(bar).toHaveCount(0);
    await expect(change).toHaveAttribute("aria-pressed", "false");
    await expectNoSidewaysScroll(page, "sideways scroll after the dates were set");
    const stored = psql(
      `select string_agg(distinct s.stamped_on::text, ',') from public.user_stamps s join auth.users u on u.id = s.user_id where u.email = '${email}'`,
    );
    expect(stored).toBe("2024-03-05");
  });
});
