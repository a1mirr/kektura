import { expect, test, type Page } from "@playwright/test";
import { openAccountMenu, setFeatureFlag, signInAsNewUser } from "./helpers";

// Spec 0035 AC-5, AC-6, AC-11: the `friends` and `restaurants` flags in each state, for a signed-in user, a user on the
// allowlist and a signed-out visitor. Flags are global, so the tests run one after the other (this file is its own
// Playwright project, after the others) and leave the flags on, as the other tests expect.
test.describe.configure({ mode: "serial" });
test.afterAll(() => {
  setFeatureFlag("friends", "on");
  setFeatureFlag("restaurants", "on");
});

// The Friends entry of the account menu (spec 0014 AC-21); a visible one needs the menu open.
const friendsLink = (page: Page) => page.locator("body > header details").getByRole("link", { name: "Friends" });

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
    await openAccountMenu(page);
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
    await openAccountMenu(page);
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

test.describe("spec 0035: the restaurants flag", () => {
  const canvas = (page: Page) => page.locator(".maplibregl-canvas");
  const checkbox = (page: Page) => page.getByLabel(/^Show restaurants \(\d+\)$/);

  // Opens the dashboard and waits for the map (created after hydration); returns the requests for the data file.
  async function openMap(page: Page) {
    const fetched: string[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/data/restaurants.json")) fetched.push(request.url());
    });
    await page.goto("/en/dashboard");
    await expect(canvas(page)).toBeVisible();
    await expect(page.getByLabel("Walked stretches")).toBeVisible();
    return fetched;
  }

  test("AC-5, AC-6: off hides the checkbox, fetches nothing and drops the About credit; on shows them on the next request", async ({ page }) => {
    await signInAsNewUser(page);
    // The dashboard that sign-in lands on loads the data once the map has hydrated: wait for that (the flag is on), so
    // its request cannot be mistaken for one made while the flag is off.
    await expect(checkbox(page)).toBeVisible();
    setFeatureFlag("restaurants", "off");

    const fetchedOff = await openMap(page);
    await expect(checkbox(page)).toHaveCount(0);
    await page.waitForTimeout(500); // a late request would show up here
    expect(fetchedOff).toEqual([]);
    await page.goto("/en/about");
    await expect(page.getByRole("link", { name: "etteremhet.hu" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "heyjoe.hu" })).toBeVisible(); // the other credits stay

    setFeatureFlag("restaurants", "on"); // no deploy, no restart, no cache to clear
    const fetchedOn = await openMap(page);
    await expect(checkbox(page)).toBeVisible();
    expect(fetchedOn).toHaveLength(1);
    await page.goto("/en/about");
    await expect(page.getByRole("link", { name: "etteremhet.hu" })).toBeVisible();
  });

  test("AC-5: an allowlist shows the layer to the listed user only", async ({ page, browser }) => {
    const email = await signInAsNewUser(page);
    const other = await (await browser.newContext()).newPage();
    await signInAsNewUser(other);
    await expect(checkbox(page)).toBeVisible(); // the first dashboards have loaded their data (the flag is on)
    await expect(checkbox(other)).toBeVisible();

    setFeatureFlag("restaurants", "allowlist", [email]);
    expect(await openMap(page)).toHaveLength(1);
    await expect(checkbox(page)).toBeVisible();
    const fetchedByOther = await openMap(other);
    await expect(checkbox(other)).toHaveCount(0);
    await other.waitForTimeout(500);
    expect(fetchedByOther).toEqual([]);
  });
});
