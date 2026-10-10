import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { openAccountMenu, signInAsNewUser, signInThroughForm, stat } from "./helpers";

test.describe("spec 0006 + 0005: signing in and out on the test server", () => {
  test("AC-3, AC-5: the dummy login opens an empty dashboard marked as the test server", async ({ page }) => {
    await signInAsNewUser(page);
    await expect(page.getByRole("status")).toContainText("Test server");
    await expect(stat(page, "Stamps")).toHaveText("0 / 161");
    await expect(stat(page, "Completed")).toHaveText("0%");
  });

  test("AC-3, AC-5, AC-9: the dummy login form on the landing page signs a visitor in", async ({ page }) => {
    await signInThroughForm(page, `e2e-${randomUUID()}@kektura.test`);
    await expect(page.getByRole("status")).toContainText("Test server");
    await expect(stat(page, "Stamps")).toHaveText("0 / 161");
  });

  test("AC-8: the helper's sign-in leaves the session cookies in the browser and opens the dashboard", async ({ page }) => {
    await signInAsNewUser(page);
    const cookies = await page.context().cookies();
    expect(cookies.some((c) => /^sb-.*-auth-token/.test(c.name))).toBe(true);
    await page.reload();
    await expect(page).toHaveURL(/\/en\/dashboard$/);
  });

  test("AC-3: an invalid email is refused with the sign-in error", async ({ page }) => {
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
    const menu = await openAccountMenu(page);
    await menu.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await page.goto("/en/dashboard");
    await expect(page).toHaveURL(/\/en$/);
  });

  test("0005 AC-4, 0020 AC-3: the callback sends a failed exchange back to the landing page of a known locale, on the address the user is on", async ({
    page,
    baseURL,
  }) => {
    const go = async (query: string) => {
      const response = await page.request.get(`/auth/callback?${query}`, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      return response.headers()["location"];
    };
    expect(await go("code=not-a-real-code&locale=en")).toBe(`${baseURL}/en?error=auth`);
    expect(await go("code=not-a-real-code&locale=hu")).toBe(`${baseURL}/hu?error=auth`);
    expect(await go("code=not-a-real-code&locale=de")).toBe(`${baseURL}/de?error=auth`);
    expect(await go("code=not-a-real-code&locale=xx")).toBe(`${baseURL}/hu?error=auth`);
    expect(await go("code=not-a-real-code&locale=../evil.example")).toBe(`${baseURL}/hu?error=auth`);
    expect(await go("locale=en")).toBe(`${baseURL}/en?error=auth`);
    // An `x-forwarded-host` the proxy would set is honoured, a malformed one is not
    const forwarded = await page.request.get("/auth/callback?code=x&locale=en", {
      maxRedirects: 0,
      headers: { "x-forwarded-host": "example.test", "x-forwarded-proto": "https" },
    });
    expect(forwarded.headers()["location"]).toBe("https://example.test/en?error=auth");
    const evil = await page.request.get("/auth/callback?code=x&locale=en", { maxRedirects: 0, headers: { "x-forwarded-host": "evil.com/path" } });
    expect(evil.headers()["location"]).toBe(`${baseURL}/en?error=auth`);
  });
});
