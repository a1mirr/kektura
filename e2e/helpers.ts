import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

// Signs in through the dummy login with this email; the account is created on first use (spec 0006 AC-3).
// Posts to the route the form submits to instead of loading the landing page and filling in the form
// (spec 0030 AC-1): the session cookies land in the page's browser context, and the 303 is not followed so
// the dashboard is rendered once, by the goto.
export async function signInWithEmail(page: Page, email: string) {
  const response = await page.request.post("/auth/test-login", { form: { email, locale: "en" }, maxRedirects: 0 });
  const location = response.headers()["location"] ?? "";
  if (response.status() !== 303 || !location.endsWith("/en/dashboard")) {
    throw new Error(`Test login refused: ${response.status()} ${location}`);
  }
  await page.goto("/en/dashboard");
  await expect(page).toHaveURL(/\/en\/dashboard$/);
}

// The same sign-in through the page itself: landing page, email field, button (spec 0030 AC-2).
export async function signInThroughForm(page: Page, email: string) {
  await page.goto("/en");
  await page.getByLabel(/^Test login/).fill(email);
  await page.getByRole("button", { name: "Sign in as test user" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/);
}

// Signs in as a brand-new user (spec 0006 AC-3, AC-6), so every test starts from an empty dashboard
// and tests can run in parallel.
export async function signInAsNewUser(page: Page) {
  const email = `e2e-${randomUUID()}@kektura.test`;
  await signInWithEmail(page, email);
  return email;
}

// The value of a dashboard stat card, e.g. stat(page, "Stamps") -> "0 / 161".
export const stat = (page: Page, label: string) =>
  page.locator("dl > div", { has: page.locator("dt", { hasText: new RegExp(`^${label}$`) }) }).locator("dd");

// Opens every stage of the stamps list. Retried until it sticks, which also waits for hydration.
export async function expandAllStages(page: Page) {
  await expect(async () => {
    await page.getByRole("button", { name: "Expand all" }).click();
    await expect(page.locator("#stage-1 [aria-expanded]")).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
  }).toPass();
}
