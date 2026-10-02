import { expect, test } from "@playwright/test";
import { signInAsNewUser, stat } from "./helpers";

test.describe("spec 0006 + 0005: signing in and out on the test server", () => {
  test("0006 AC-3, AC-5: the dummy login opens an empty dashboard marked as the test server", async ({ page }) => {
    await signInAsNewUser(page);
    await expect(page.getByRole("status")).toContainText("Test server");
    await expect(stat(page, "Stamps")).toHaveText("0 / 161");
    await expect(stat(page, "Completed")).toHaveText("0%");
  });

  test("0006 AC-3: an invalid email is refused with the sign-in error", async ({ page }) => {
    // The form's own validation stops this in the browser, so post it directly.
    const response = await page.request.post("/auth/test-login", { form: { email: "not-an-email", locale: "en" } });
    expect(new URL(response.url()).pathname + new URL(response.url()).search).toBe("/en?error=auth");
  });

  test("0005 AC-2: a signed-in visitor of the landing page goes straight to the dashboard", async ({ page }) => {
    await signInAsNewUser(page);
    await page.goto("/en");
    await expect(page).toHaveURL(/\/en\/dashboard$/);
  });

  test("0005 AC-6, AC-3: signing out returns to the landing page, after which the dashboard redirects there", async ({ page }) => {
    await signInAsNewUser(page);
    await page.getByRole("link", { name: "Account", exact: true }).click(); // spec 0025: sign out lives there
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await page.goto("/en/dashboard");
    await expect(page).toHaveURL(/\/en$/);
  });
});
