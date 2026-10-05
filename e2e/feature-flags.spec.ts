import { expect, test, type Page } from "@playwright/test";
import { setFeatureFlag, signInAsNewUser } from "./helpers";

// Spec 0035 AC-5, AC-6, AC-11: the `friends` flag in each state, for a signed-in user, a user on the allowlist and
// a signed-out visitor. Flags are global, so the tests run one after the other (this file is its own Playwright
// project, after the others) and leave the flag on, as the other tests expect.
test.describe.configure({ mode: "serial" });
test.afterAll(() => setFeatureFlag("friends", "on"));

const friendsLink = (page: Page) => page.locator("header").getByRole("link", { name: "Friends" });

async function friendsAnswer(page: Page) {
  return (await page.goto("/en/friends"))?.status();
}

test.describe("spec 0035: a flag that is off is off", () => {
  test("AC-5, AC-6: off hides the pages, the link and the About paragraph; the next request after `on` shows them", async ({ page }) => {
    await signInAsNewUser(page);
    setFeatureFlag("friends", "off");

    expect(await friendsAnswer(page)).toBe(404);
    expect((await page.goto("/en/friends/invite/0123456789abcdef0123456789abcdef"))?.status()).toBe(404);
    await page.goto("/en/dashboard");
    await expect(friendsLink(page)).toHaveCount(0);
    await page.goto("/en/about");
    await expect(page.getByText("If you connect with friends")).toHaveCount(0);

    setFeatureFlag("friends", "on"); // no deploy, no restart, no cache to clear (AC-6)
    expect(await friendsAnswer(page)).toBe(200);
    await page.goto("/en/dashboard");
    await expect(friendsLink(page)).toBeVisible();
    await page.goto("/en/about");
    await expect(page.getByText("If you connect with friends")).toBeVisible();
  });

  test("AC-3, AC-5: an allowlist turns the feature on for the listed user only, signed-out visitors included", async ({ page, browser }) => {
    const email = await signInAsNewUser(page);
    const other = await (await browser.newContext()).newPage();
    await signInAsNewUser(other);
    const visitor = await (await browser.newContext()).newPage();

    setFeatureFlag("friends", "allowlist", [email]);
    expect(await friendsAnswer(page)).toBe(200);
    await page.goto("/en/dashboard");
    await expect(friendsLink(page)).toBeVisible();
    expect(await friendsAnswer(other)).toBe(404);
    expect(await friendsAnswer(visitor)).toBe(404);

    setFeatureFlag("friends", "on");
    expect(await friendsAnswer(other)).toBe(200);
    // On means everybody: a signed-out visitor is sent to sign in instead of getting a 404.
    expect((await visitor.goto("/en/friends"))?.url()).not.toContain("/en/friends");
    await expect(visitor).toHaveURL(/\/en\/?$/);
  });

  test("AC-5: with the flag off the server action answers `disabled` and changes nothing", async ({ page }) => {
    await signInAsNewUser(page);
    setFeatureFlag("friends", "on");
    await page.goto("/en/friends");
    await expect(page.getByLabel("Your name (shown to friends)")).toBeVisible();
    await page.getByLabel("Your name (shown to friends)").fill("Flagged");
    setFeatureFlag("friends", "off"); // switched off while the page is open: the action must check for itself
    await page.getByRole("button", { name: "Save" }).click();
    // The refused action sends the page back with its reason, and the page itself is a 404 now: wait for that, so the
    // flag goes back on only after the action has been answered.
    await expect(page).toHaveURL(/\/en\/friends\?error=disabled$/);
    setFeatureFlag("friends", "on");
    await page.goto("/en/friends");
    await expect(page.getByLabel("Your name (shown to friends)")).not.toHaveValue("Flagged");
  });
});
