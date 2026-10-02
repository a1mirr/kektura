import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { expandAllStages, signInAsNewUser, signInWithEmail, stat } from "./helpers";
import { psql } from "./local-db";

// Presses "Delete account" once the page has hydrated (before that the click does nothing).
async function openDeleteConfirmation(page: Page) {
  await expect(async () => {
    await page.getByRole("button", { name: "Delete account" }).click();
    await expect(page.getByText("Are you sure? This cannot be undone.")).toBeVisible({ timeout: 1_000 });
  }).toPass();
}

const count = (sql: string) => Number(psql(sql));

test.describe("spec 0014: account settings", () => {
  test("AC-7: signed-out visitors are sent to the landing page", async ({ page }) => {
    await page.goto("/en/settings");
    await expect(page).toHaveURL(/\/en$/);
  });

  test("AC-7, AC-8, AC-9: the dashboard header leads to the settings; cancelling deletes nothing", async ({ page }) => {
    const email = await signInAsNewUser(page);
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/en\/settings$/);
    await expect(page).toHaveTitle("Account settings");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Account settings");
    await expect(page.getByRole("heading", { name: "Stamps per month" })).toBeVisible();

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

    // Some data to lose: an official stamp, an extra stamp, and a feedback message.
    await expandAllStages(page);
    await page.locator("#place-OKTPH_02").getByRole("button", { name: "Add stamp" }).click();
    await expect(stat(page, "Stamps")).toHaveText("1 / 161");
    psql(`insert into public.user_extra_stamps (user_id, extra_id) select '${userId}', min(id) from public.extra_stamps`);
    psql(`insert into public.user_feedback (user_id, message) values ('${userId}', 'to keep ${marker}')`);
    expect(count(`select count(*) from public.user_stamps where user_id = '${userId}'`)).toBe(1);

    await page.goto("/en/settings");
    await openDeleteConfirmation(page);
    await page.getByRole("button", { name: "Yes, permanently delete my account" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();

    expect(count(`select count(*) from auth.users where id = '${userId}'`)).toBe(0);
    expect(count(`select count(*) from public.user_stamps where user_id = '${userId}'`)).toBe(0);
    expect(count(`select count(*) from public.user_extra_stamps where user_id = '${userId}'`)).toBe(0);
    expect(psql(`select coalesce(user_id::text, 'unlinked'), message from public.user_feedback where message like '%${marker}%'`)).toBe(
      `unlinked|to keep ${marker}`,
    );

    // Signed out for real: the dashboard sends us back, and the same email starts a fresh account.
    await page.goto("/en/dashboard");
    await expect(page).toHaveURL(/\/en$/);
    await signInWithEmail(page, email);
    await expect(stat(page, "Stamps")).toHaveText("0 / 161");
  });

  test("AC-11: when the server fails, the page says so and nothing is deleted", async ({ page }) => {
    const email = await signInAsNewUser(page);
    await page.goto("/en/settings");
    // Make the server action fail like a dropped connection or a server error.
    await page.route("**/en/settings", (route) =>
      route.request().headers()["next-action"] ? route.fulfill({ status: 500, body: "boom" }) : route.continue(),
    );
    await openDeleteConfirmation(page);
    await page.getByRole("button", { name: "Yes, permanently delete my account" }).click();

    // (Next's hidden route announcer also has role="alert", so match the text.)
    await expect(page.getByText("Couldn't delete the account. Please try again.")).toBeVisible();
    await expect(page).toHaveURL(/\/en\/settings$/);
    await expect(page.getByRole("button", { name: "Yes, permanently delete my account" })).toBeEnabled();
    expect(count(`select count(*) from auth.users where email = '${email}'`)).toBe(1);
  });
});
