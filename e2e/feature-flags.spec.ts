import { expect, test, type Page } from "@playwright/test";
import { expectNoSidewaysScroll, openAccountMenu, setFeatureFlag, signInAsNewUser, stampStagesOn } from "./helpers";
import { describeFindings, judge, scan, WIDTHS } from "./accessibility";
import { psql } from "./local-db";

test.describe.configure({ mode: "serial" });
test.afterAll(() => {
  setFeatureFlag("friends", "on");
  setFeatureFlag("restaurants", "on");
});

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

    setFeatureFlag("friends", "on");
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
    await expect(page.getByRole("link", { name: "heyjoe.hu" })).toBeVisible();

    setFeatureFlag("restaurants", "on");
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
    await expect(checkbox(page)).toBeVisible();
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

test.describe("spec 0039: the share flag and share cards", () => {
  test.afterAll(() => setFeatureFlag("share", "off")); // off is what production starts with; no other test needs it on

  // Built at run time, from a repeated pair: a 32-character hex literal, or one with many different characters, assigned to a constant is what the secret scanner takes for an API key.
  const UNKNOWN_TOKEN = "ab".repeat(16);
  const panel = (page: Page) => page.getByRole("region", { name: "Share your progress" });

  test("AC-1: off hides the panel and answers 404 for a page and the image; on shows them on the next request", async ({ page, browser }) => {
    await signInAsNewUser(page);
    setFeatureFlag("share", "off");
    await page.goto("/en/stats");
    await expect(page.getByRole("heading", { name: "My stats" })).toBeVisible();
    await expect(panel(page)).toHaveCount(0);
    await page.goto("/en/about");
    await expect(page.getByText("If you create a share card")).toHaveCount(0);

    setFeatureFlag("share", "on");
    await page.goto("/en/about");
    await expect(page.getByText("If you create a share card")).toBeVisible();
    await page.goto("/en/stats");
    await panel(page).getByRole("button", { name: "Create a card" }).click();
    await expect(panel(page).getByRole("link", { name: "Open" })).toBeVisible();
    const link = await panel(page).getByLabel("Link to the card").inputValue();
    const path = new URL(link).pathname;
    const visitor = await (await browser.newContext()).newPage();
    expect((await visitor.goto(path))?.status()).toBe(200);

    setFeatureFlag("share", "off");
    expect((await visitor.goto(path))?.status()).toBe(404);
    expect((await visitor.request.get(`/api/share/${path.split("/").pop()}/image`)).status()).toBe(404);
    expect((await visitor.goto(`/en/share/${UNKNOWN_TOKEN}`))?.status()).toBe(404);

    setFeatureFlag("share", "on");
    expect((await visitor.goto(path))?.status()).toBe(200);
  });

  test("AC-2 to AC-6: a card is created, opened by a signed-out visitor with its preview tags and image, and deleted", async ({ page, browser }) => {
    const email = await signInAsNewUser(page);
    stampStagesOn(email, 2, "2026-06-01");
    setFeatureFlag("share", "on");
    await page.goto("/en/stats");

    await panel(page).getByRole("button", { name: "Create a card" }).click();
    const item = panel(page).getByRole("listitem").filter({ hasText: "anonymous" });
    await expect(item).toHaveCount(1);
    const link = await item.getByLabel("Link to the card").inputValue();
    expect(link).toMatch(/\/en\/share\/[0-9a-f]{32}$/);
    await expect(item.getByRole("link", { name: "Send to Telegram" })).toHaveAttribute("href", /^https:\/\/t\.me\/share\/url\?url=.+&text=.+/);
    const numbers = (await item.locator("p").first().innerText()).match(/^(\d+)% · (\d+) \/ 161 stamps$/);
    expect(numbers).not.toBeNull();
    const [, percent, stamps] = numbers!;

    const visitorContext = await browser.newContext();
    const visitor = await visitorContext.newPage();
    const path = new URL(link).pathname;
    expect((await visitor.goto(path))?.status()).toBe(200);
    await expect(visitor.getByRole("heading", { name: "Kéktúra progress", level: 1 })).toBeVisible();
    await expect(visitor.getByText(`${percent}%`, { exact: true })).toBeVisible();
    await expect(visitor.getByText(`${stamps} / 161`)).toBeVisible();
    await expect(visitor.getByRole("img", { name: "Map of the trail with the walked part in blue" })).toBeVisible();
    await expect(visitor.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(visitor.locator('meta[property="og:title"]')).toHaveAttribute("content", "Kéktúra progress");
    await expect(visitor.locator('meta[property="og:description"]')).toHaveAttribute("content", new RegExp(`^${stamps} of 161 stamps`));
    const imageUrl = await visitor.locator('meta[property="og:image"]').getAttribute("content");
    expect(imageUrl).toMatch(/\/api\/share\/[0-9a-f]{32}\/image$/);
    expect(await visitor.content()).not.toContain(email);

    const image = await visitor.request.get(new URL(imageUrl!).pathname);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toBe("image/png");
    expect((await image.body()).subarray(1, 4).toString()).toBe("PNG");

    psql(
      `insert into public.user_stamps (user_id, checkpoint_id, stamped_on) select u.id, c.id, '2026-06-02' from auth.users u, public.checkpoints c where u.email = '${email}' and c.stage = 3 and c.retired_on is null`,
    );
    await visitor.reload();
    await expect(visitor.getByText(`${stamps} / 161`)).toBeVisible();

    await page.reload();
    await panel(page).getByLabel("Show my name on the card").check();
    await panel(page).getByRole("button", { name: "Create a card" }).click();
    await expect(panel(page).getByRole("listitem")).toHaveCount(2);
    const named = panel(page).getByRole("listitem").filter({ hasText: "with your name" });
    await expect(named).toHaveCount(1);
    const name = psql(`select p.display_name from public.profiles p join auth.users u on u.id = p.id where u.email = '${email}'`);
    await visitor.goto(new URL(await named.getByLabel("Link to the card").inputValue()).pathname);
    await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(`${name}'s Kéktúra progress`);

    await item.getByRole("button", { name: "Delete" }).click();
    await item.getByRole("button", { name: "Cancel" }).click();
    expect((await visitor.goto(path))?.status()).toBe(200);
    await item.getByRole("button", { name: "Delete" }).click();
    await item.getByRole("button", { name: "Yes, delete" }).click();
    await expect(panel(page).getByRole("listitem")).toHaveCount(1);
    expect((await visitor.goto(path))?.status()).toBe(404);
    expect((await visitor.request.get(new URL(imageUrl!).pathname)).status()).toBe(404);
    await visitorContext.close();
  });

  test("AC-6, AC-4: axe finds nothing serious on the stats page with the panel and a card, nor on the share page, at both widths", async ({ page, browser }) => {
    const email = await signInAsNewUser(page);
    stampStagesOn(email, 2, "2026-06-01");
    setFeatureFlag("share", "on");
    await page.goto("/en/stats");
    await panel(page).getByRole("button", { name: "Create a card" }).click();
    await expect(panel(page).getByRole("listitem")).toHaveCount(1);
    await panel(page).getByRole("button", { name: "Delete" }).click();
    await expect(panel(page).getByRole("button", { name: "Yes, delete" })).toBeVisible();
    const path = new URL(await panel(page).getByLabel("Link to the card").inputValue()).pathname;
    const visitor = await (await browser.newContext()).newPage();

    for (const width of ["desktop", "phone"] as const) {
      await page.setViewportSize(WIDTHS[width]);
      await visitor.setViewportSize(WIDTHS[width]);
      await visitor.goto(path);
      await expect(visitor.getByRole("img", { name: "Map of the trail with the walked part in blue" })).toBeVisible();
      for (const [name, target] of [["stats-share-panel", page], ["share-page", visitor]] as const) {
        const { unlisted } = judge(name, await scan(target, width), []);
        expect(describeFindings(unlisted), `${name} at ${width}`).toEqual([]);
      }
    }

    await page.setViewportSize(WIDTHS.phone);
    for (const locale of ["de", "hu", "ru"]) {
      await page.goto(`/${locale}/stats`);
      await expect(page.locator("#share-title")).toBeVisible();
      await expectNoSidewaysScroll(page, `the stats page with the share panel in ${locale} at 375 px`);
    }
  });

  test("AC-4: a visitor who is not signed in can open a card in every language, and an unknown or malformed token is a 404", async ({ page, browser }) => {
    await signInAsNewUser(page);
    setFeatureFlag("share", "on");
    await page.goto("/en/stats");
    await panel(page).getByRole("button", { name: "Create a card" }).click();
    const link = await panel(page).getByLabel("Link to the card").inputValue();
    const token = link.split("/").pop()!;
    const visitor = await (await browser.newContext()).newPage();
    for (const [locale, title] of [["hu", "Kéktúra-haladás"], ["de", "Kéktúra-Fortschritt"], ["ru", "Прогресс на Кектуре"], ["en", "Kéktúra progress"]]) {
      expect((await visitor.goto(`/${locale}/share/${token}`))?.status()).toBe(200);
      await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(title);
    }
    expect((await visitor.goto(`/en/share/${UNKNOWN_TOKEN}`))?.status()).toBe(404);
    expect((await visitor.goto("/en/share/not-a-token"))?.status()).toBe(404);
    expect((await visitor.request.get(`/api/share/${UNKNOWN_TOKEN}/image`)).status()).toBe(404);

    for (const width of [375, 320]) {
      await visitor.setViewportSize({ width, height: 800 });
      for (const locale of ["de", "hu", "ru"]) {
        await visitor.goto(`/${locale}/share/${token}`);
        await expectNoSidewaysScroll(visitor, `the share page in ${locale} at ${width} px`);
      }
    }
  });
});
