import { randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { expandAllStages, expectNoSidewaysScroll, signInAsNewUser, stat } from "./helpers";

// Spec 0006 AC-10: the pages at a phone's width, in the `mobile` project (Chromium, 375 x 812, touch, mobile emulation,
// see playwright.config.ts). The tag on the describe is what puts these tests there and keeps them out of the desktop
// project. Each test checks that its page does not scroll sideways and that the page's main action is on the screen
// and works when tapped (a tap needs a touch screen: `locator.tap()` fails in the desktop project).

// The control is on the screen: visible, inside the window sideways, and big enough to hit with a thumb: at least 24 px
// each way (WCAG 2.2's target size), or `minSize` where a spec promises more (44 px: specs 0014 AC-16, 0024 AC-20).
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
    const row = page.locator("#place-OKTPH_02"); // Hét-forrás
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

  // The trail map is a section of the dashboard (there is no page of its own), and its main action is going fullscreen.
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

  test("AC-10: the account page does not scroll sideways, and signing out works with a tap", async ({ page }) => {
    await signInAsNewUser(page);
    await page.goto("/en/account");
    await expect(page.getByRole("heading", { name: "Stamps per month" })).toBeVisible();
    await expectNoSidewaysScroll(page, "sideways scroll on the account page");
    const signOut = page.getByRole("button", { name: "Sign out" });
    await expectTappable(page, signOut, "the sign-out button", 44);
    await expectTappable(page, page.getByRole("button", { name: "Delete account" }), "the delete button");
    await signOut.tap();
    await expect(page).toHaveURL(/\/en$/);
  });
});
