import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { routing } from "../src/i18n/routing";
import { accountButton, expandAllStages, openAccountMenu, signInAsNewUser, signInWithEmail, stat } from "./helpers";
import { psql } from "./local-db";

// Presses "Delete account" once the page has hydrated (before that the click does nothing).
async function openDeleteConfirmation(page: Page) {
  await expect(async () => {
    await page.getByRole("button", { name: "Delete account" }).click();
    await expect(page.getByText("Are you sure? This cannot be undone.")).toBeVisible({ timeout: 1_000 });
  }).toPass();
}

const count = (sql: string) => Number(psql(sql));

test.describe("spec 0014: the settings page", () => {
  test("AC-7, AC-15: signed-out visitors are sent to the landing page", async ({ page }) => {
    await page.goto("/en/account");
    await expect(page).toHaveURL(/\/en$/);
    await page.goto("/en/settings"); // the address /settings: redirected to /account, then to the landing page
    await expect(page).toHaveURL(/\/en$/);
  });

  test("AC-7, AC-15, AC-18: the account menu leads to the settings page, which has no chart; cancelling deletes nothing", async ({ page }) => {
    const email = await signInAsNewUser(page);
    // The stamps-per-month chart is on the stats page, not on the dashboard (it renders in one piece, so once the
    // account button is there, a missing chart really is missing).
    await expect(accountButton(page)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Stamps per month" })).toHaveCount(0);
    await (await openAccountMenu(page)).getByRole("link", { name: "Settings", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/account$/);
    await expect(page).toHaveTitle("Settings");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Settings");
    await expect(page.getByRole("heading", { name: "Stamps per month" })).toHaveCount(0);

    await openDeleteConfirmation(page);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Are you sure? This cannot be undone.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete account" })).toBeVisible();
    expect(count(`select count(*) from auth.users where email = '${email}'`)).toBe(1);
  });

  test("AC-9, AC-10: deleting removes the account and its stamps, keeps feedback unlinked, and signs out", async ({
    page,
  }) => {
    const marker = randomUUID();
    const email = await signInAsNewUser(page);
    const userId = psql(`select id from auth.users where email = '${email}'`);

    await expandAllStages(page);
    await page.locator("#place-OKTPH_02").getByRole("button", { name: "Add stamp" }).click();
    await expect(stat(page, "Stamps")).toHaveText("1 / 161");
    psql(`insert into public.user_extra_stamps (user_id, extra_id) select '${userId}', min(id) from public.extra_stamps`);
    psql(`insert into public.user_feedback (user_id, message) values ('${userId}', 'to keep ${marker}')`);
    expect(count(`select count(*) from public.user_stamps where user_id = '${userId}'`)).toBe(1);

    await page.goto("/en/account");
    await openDeleteConfirmation(page);
    await page.getByRole("button", { name: "Yes, permanently delete my account" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
    await expect(accountButton(page)).toHaveCount(0); // The layout's strip follows the session: no account menu for a deleted account

    expect(count(`select count(*) from auth.users where id = '${userId}'`)).toBe(0);
    expect(count(`select count(*) from public.user_stamps where user_id = '${userId}'`)).toBe(0);
    expect(count(`select count(*) from public.user_extra_stamps where user_id = '${userId}'`)).toBe(0);
    expect(psql(`select coalesce(user_id::text, 'unlinked'), message from public.user_feedback where message like '%${marker}%'`)).toBe(
      `unlinked|to keep ${marker}`,
    );

    await page.goto("/en/dashboard");
    await expect(page).toHaveURL(/\/en$/);
    await signInWithEmail(page, email);
    await expect(stat(page, "Stamps")).toHaveText("0 / 161");
  });

  test("AC-11: when the server fails, the page says so and nothing is deleted", async ({ page }) => {
    const email = await signInAsNewUser(page);
    await page.goto("/en/account");
    await page.route("**/en/account", (route) =>
      route.request().headers()["next-action"] ? route.fulfill({ status: 500, body: "boom" }) : route.continue(),
    );
    await openDeleteConfirmation(page);
    await page.getByRole("button", { name: "Yes, permanently delete my account" }).click();

    // (Next's hidden route announcer also has role="alert", so match the text.)
    await expect(page.getByText("Couldn't delete the account. Please try again.")).toBeVisible();
    await expect(page).toHaveURL(/\/en\/account$/);
    await expect(page.getByRole("button", { name: "Yes, permanently delete my account" })).toBeEnabled();
    expect(count(`select count(*) from auth.users where email = '${email}'`)).toBe(1);
  });
});

test.describe("spec 0014: sign out and the settings address", () => {
  test("AC-15: the old /settings address redirects to /account in the same language", async ({ page }) => {
    await signInAsNewUser(page);
    await page.goto("/en/settings");
    await expect(page).toHaveURL(/\/en\/account$/);
    await page.goto("/settings"); // no language prefix: the proxy adds one, then the redirect applies
    await expect(page).toHaveURL(new RegExp(`/(${routing.locales.join("|")})/account$`));
  });

  test("AC-16: signing out from the settings page ends the session for the dashboard and the settings page", async ({ page }) => {
    await signInAsNewUser(page);
    await (await openAccountMenu(page)).getByRole("link", { name: "Settings", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/account$/);
    const header = page.locator("main > header");
    await expect(header.getByRole("heading", { level: 1 })).toHaveText("Settings");
    await header.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
    for (const path of ["/en/dashboard", "/en/account"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/en$/);
    }
  });

  test("AC-17: the Sign out button works with JavaScript off", async ({ page, browser, baseURL }) => {
    await signInAsNewUser(page);
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false, storageState: await page.context().storageState() });
    try {
      const plain = await context.newPage();
      await plain.goto("/en/account");
      await plain.getByRole("button", { name: "Sign out" }).click();
      await expect(plain).toHaveURL(/\/en$/);
      await plain.goto("/en/account");
      await expect(plain).toHaveURL(/\/en$/);
    } finally {
      await context.close();
    }
  });

});
