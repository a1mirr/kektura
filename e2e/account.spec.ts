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

test.describe("spec 0014: the account page", () => {
  test("AC-7, AC-15: signed-out visitors are sent to the landing page", async ({ page }) => {
    await page.goto("/en/account");
    await expect(page).toHaveURL(/\/en$/);
    await page.goto("/en/settings"); // the old address: redirected to /account, then to the landing page
    await expect(page).toHaveURL(/\/en$/);
  });

  test("AC-7, AC-8, AC-9, AC-14, AC-15: the dashboard header leads to the account page; cancelling deletes nothing", async ({ page }) => {
    const email = await signInAsNewUser(page);
    // AC-8: the chart is on the account page, not here (the dashboard renders in one piece, so once its
    // Account link is there, a missing chart really is missing).
    await expect(page.getByRole("link", { name: "Account", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Stamps per month" })).toHaveCount(0);
    await page.getByRole("link", { name: "Account", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/account$/);
    await expect(page).toHaveTitle("Account");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Account");
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

    await page.goto("/en/account");
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
    await page.goto("/en/account");
    // Make the server action fail like a dropped connection or a server error.
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

test.describe("spec 0014: sign out and the account link", () => {
  test("AC-14: the dashboard header has one Account link and no Settings link or Sign out control", async ({ page }) => {
    await signInAsNewUser(page);
    const header = page.locator("main > header");
    await expect(header.getByRole("link", { name: "Account", exact: true })).toHaveAttribute("href", "/en/account");
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  });

  test("AC-15: the old /settings address redirects to /account in the same language", async ({ page }) => {
    await signInAsNewUser(page);
    for (const locale of ["en", "ru", "hu"]) {
      await page.goto(`/${locale}/settings`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/account$`));
    }
    await page.goto("/settings"); // no language prefix: the proxy adds one, then the redirect applies
    await expect(page).toHaveURL(/\/(ru|en|hu)\/account$/);
  });

  test("AC-16: signing out from the account page ends the session for the dashboard and the account page", async ({ page }) => {
    await signInAsNewUser(page);
    await page.getByRole("link", { name: "Account", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/account$/);
    const header = page.locator("main > header"); // the button sits next to the heading
    await expect(header.getByRole("heading", { level: 1 })).toHaveText("Account");
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

  test("AC-16, AC-18: the link, the page and the button are translated, and signing out returns to the landing page of that language", async ({ page }) => {
    for (const [locale, account, signOut] of [
      ["ru", "Аккаунт", "Выйти"],
      ["hu", "Fiók", "Kijelentkezés"],
    ]) {
      await signInAsNewUser(page);
      await page.goto(`/${locale}/dashboard`);
      await page.getByRole("link", { name: account, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/account$`));
      await expect(page).toHaveTitle(account);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(account);
      await page.getByRole("button", { name: signOut }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}$`));
    }
  });
});

test.describe("spec 0001: the stamps-per-month chart on the account page", () => {
  test("AC-5: month labels and the tooltip follow the page's language", async ({ page }) => {
    await signInAsNewUser(page);
    await expandAllStages(page);
    await page.locator("#place-OKTPH_02").getByRole("button", { name: "Add stamp" }).click();
    await expect(stat(page, "Stamps")).toHaveText("1 / 161");

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; // the stamp's own day, as the browser sent it
    const labels = new Set<string>();
    for (const locale of ["en", "ru", "hu"]) {
      const label = new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
      labels.add(label);
      await page.goto(`/${locale}/account`);
      const chart = page.locator(".recharts-wrapper");
      await expect(chart.locator(".recharts-cartesian-axis-tick-value").first()).toHaveText(label);
      await chart.locator(".recharts-bar-rectangle").first().hover();
      await expect(chart.locator(".recharts-tooltip-wrapper")).toContainText(label);
    }
    expect(labels.size, "the three languages write the month differently").toBe(3);
  });
});
