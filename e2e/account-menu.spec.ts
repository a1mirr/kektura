import { expect, test, type Page } from "@playwright/test";
import { accountButton, openAccountMenu, signInAsNewUser } from "./helpers";

// The header strip's account menu. What it shows in each state of the `friends` flag is checked in
// e2e/feature-flags.spec.ts (flags are global), its words in every language in e2e/languages.spec.ts, and the phone's
// 375 px in e2e/mobile.spec.ts. Texts are English; the menu is a `<details>`, so most of it works with the page's script off.
const list = (page: Page) => page.locator("body > header details ul");
const entries = (page: Page) => list(page).getByRole("link");

// Every page a signed-in visitor sees: the dashboard, the three pages of the menu and one that is not in it.
// The About, Changelog, Useful links and Feedback pages were static before the strip read the session: the button on them shows
// That they render per request now.
const SIGNED_IN_PAGES = ["/dashboard", "/stats", "/friends", "/account", "/about", "/changelog", "/links", "/feedback"];

test.describe("spec 0014: the account menu", () => {
  test("AC-20: every page a signed-in visitor sees has one account button in the header strip, and no separate Friends, Settings or Account link", async ({
    page,
  }) => {
    test.setTimeout(120_000); // the dashboard with its map takes a few seconds to load, and the loop opens eight pages
    await signInAsNewUser(page);
    for (const path of SIGNED_IN_PAGES) {
      await page.goto(`/en${path}`);
      await expect(accountButton(page), path).toHaveCount(1);
      await expect(accountButton(page), path).toHaveText("Account");
      // closed, the strip links to the main page alone: the entries and Sign out are not on the screen
      await expect(page.locator("body > header").getByRole("link").filter({ visible: true }), path).toHaveCount(1);
      await expect(page.locator("body > header").getByRole("button", { name: "Sign out" }).filter({ visible: true }), path).toHaveCount(0);
    }
    // the page's own title row has no account links any more (they were the dashboard's header links)
    for (const path of ["/stats", "/account"]) {
      await page.goto(`/en${path}`);
      await expect(page.locator("main > header").getByRole("link"), path).toHaveCount(0);
    }
    await page.goto("/en/dashboard");
    await expect(page.locator("main > header").getByRole("link")).toHaveCount(0);
    await expect(page.locator("main > header").getByRole("heading", { level: 1 })).toHaveText("My progress");
  });

  test("AC-20: the strip also carries the language switcher, left of the button, and the logo stays first", async ({ page }) => {
    await signInAsNewUser(page);
    await page.goto("/en/stats");
    const logo = await page.locator("body > header a").first().boundingBox();
    const switcher = await page.getByRole("combobox", { name: "Language" }).boundingBox();
    const button = (await accountButton(page).boundingBox())!;
    expect(logo!.x).toBeLessThan(switcher!.x);
    expect(switcher!.x + switcher!.width).toBeLessThanOrEqual(button.x);
    expect(Math.abs(switcher!.y - button.y)).toBeLessThan(2);
  });

  test("AC-20: a signed-out visitor gets the language switcher and no account menu, and the 404 page has neither", async ({ page }) => {
    for (const path of ["", "/about", "/changelog", "/links", "/feedback"]) {
      await page.goto(`/en${path}`);
      await expect(page.getByRole("combobox", { name: "Language" }), path).toBeVisible();
      await expect(accountButton(page), path).toHaveCount(0);
    }
    const response = await page.goto("/en/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(accountButton(page)).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Language" })).toHaveCount(0);
  });

  test("AC-21, AC-26: the list is My stats, Friends, Settings, then Sign out, with the right addresses", async ({ page }) => {
    await signInAsNewUser(page);
    const menu = await openAccountMenu(page);
    await expect(entries(page)).toHaveText(["My stats", "Friends", "Settings"]);
    expect(await entries(page).evaluateAll((els) => els.map((e) => e.getAttribute("href")))).toEqual(["/en/stats", "/en/friends", "/en/account"]);
    await expect(menu.getByRole("button", { name: "Sign out" })).toBeVisible();
    expect(await menu.locator("li").last().getByRole("button", { name: "Sign out" }).count()).toBe(1);
  });

  test("AC-21, AC-18: each entry leads to its page, in the page's language", async ({ page }) => {
    await signInAsNewUser(page);
    for (const [name, url, heading] of [
      ["My stats", /\/en\/stats$/, "My stats"],
      ["Friends", /\/en\/friends$/, "Your friends"],
      ["Settings", /\/en\/account$/, "Settings"],
    ] as const) {
      await page.goto("/en/about");
      await (await openAccountMenu(page)).getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(url);
      await expect(page.getByRole("heading", { level: name === "Friends" ? 2 : 1, name: heading })).toBeVisible();
    }
    await page.goto("/de/about");
    await expect(page.locator("body > header summary")).toHaveText("Konto");
  });

  test("AC-24: the entry of the page the visitor is on is marked, visibly, and no other is", async ({ page }) => {
    await signInAsNewUser(page);
    for (const [path, name] of [
      ["/stats", "My stats"],
      ["/friends", "Friends"],
      ["/account", "Settings"],
    ] as const) {
      await page.goto(`/en${path}`);
      await openAccountMenu(page);
      const current = list(page).locator("a[aria-current]");
      await expect(current).toHaveCount(1);
      await expect(current).toHaveText(name);
      await expect(current).toHaveAttribute("aria-current", "page");
      // visibly: the marked entry is bold, and no other entry is
      const weights = await entries(page).evaluateAll((els) => els.map((e) => Number(getComputedStyle(e).fontWeight)));
      expect(weights.filter((w) => w >= 600)).toHaveLength(1);
    }
    await page.goto("/en/dashboard");
    await openAccountMenu(page);
    await expect(list(page).locator("[aria-current]")).toHaveCount(0);
  });

  test("AC-22: Enter and Space open and close the list, Tab moves through the entries in order, Escape closes it and returns the focus", async ({
    page,
  }) => {
    await signInAsNewUser(page);
    const button = accountButton(page);
    await expect(button).toHaveAttribute("aria-expanded", "false"); // hydrated
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(entries(page).first()).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(entries(page).first()).toBeHidden();
    await page.keyboard.press("Space");
    await expect(button).toHaveAttribute("aria-expanded", "true");

    for (const name of ["My stats", "Friends", "Settings"]) {
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name, exact: true }).filter({ visible: true }).and(page.locator(":focus"))).toHaveCount(1);
    }
    await page.keyboard.press("Tab");
    await expect(list(page).getByRole("button", { name: "Sign out" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toBeFocused();
    await expect(entries(page).first()).toBeHidden();
  });

  test("AC-22: a click outside closes the list; a click inside it does not; following a link closes it", async ({ page }) => {
    await signInAsNewUser(page);
    const button = accountButton(page);
    const menu = await openAccountMenu(page);
    await menu.click({ position: { x: 4, y: 2 } }); // the list's own padding
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("heading", { level: 1 }).click();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(entries(page).first()).toBeHidden();

    await openAccountMenu(page);
    await page.getByRole("link", { name: "My stats", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/stats$/);
    await expect(button).toHaveAttribute("aria-expanded", "false"); // the layout stays mounted: the move closed it
    await expect(entries(page).first()).toBeHidden();
  });

  test("AC-22: the button has an accessible name and exposes its open state natively", async ({ page }) => {
    await signInAsNewUser(page);
    const details = page.locator("body > header details");
    await expect(accountButton(page)).toHaveText("Account");
    await expect(details).not.toHaveAttribute("open", /.*/);
    await openAccountMenu(page);
    await expect(details).toHaveAttribute("open", "");
    expect(await list(page).evaluate((ul) => ul.closest("[role=menu]") || ul.querySelector("[role=menu], [role=menuitem]"))).toBeNull(); // not an application menu
  });

  test("AC-23, AC-26: with JavaScript off the entries open, lead to their pages, and Sign out signs out", async ({ page, browser, baseURL }) => {
    await signInAsNewUser(page);
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false, storageState: await page.context().storageState() });
    try {
      const plain = await context.newPage();
      await plain.goto("/en/dashboard");
      const button = accountButton(plain);
      await expect(button).toBeVisible();
      await expect(plain.getByRole("link", { name: "My stats", exact: true })).toBeHidden();
      await button.click();
      await expect(entries(plain)).toHaveText(["My stats", "Friends", "Settings"]);
      await entries(plain).nth(2).click();
      await expect(plain).toHaveURL(/\/en\/account$/);
      await accountButton(plain).click();
      await expect(list(plain).locator("a[aria-current]")).toHaveText("Settings");
      await list(plain).getByRole("button", { name: "Sign out" }).click();
      await expect(plain).toHaveURL(/\/en$/);
      await expect(accountButton(plain)).toHaveCount(0);
      await plain.goto("/en/dashboard");
      await expect(plain).toHaveURL(/\/en$/);
    } finally {
      await context.close();
    }
  });

  test("AC-26: Sign out in the menu ends the session, and the settings page keeps its own Sign out", async ({ page }) => {
    await signInAsNewUser(page);
    await (await openAccountMenu(page)).getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
    await expect(accountButton(page)).toHaveCount(0);
    for (const path of ["/en/dashboard", "/en/account"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/en$/);
    }
  });

  test("AC-25: on a desktop window the list hangs under the button, is at least 200 px wide, and stays inside the window", async ({ page }) => {
    for (const width of [1440, 1024, 768]) {
      await page.setViewportSize({ width, height: 800 });
      await signInAsNewUser(page);
      await page.goto("/en/dashboard");
      const button = (await accountButton(page).boundingBox())!;
      await openAccountMenu(page);
      const box = (await list(page).boundingBox())!;
      expect(box.width, `${width} px: width`).toBeGreaterThanOrEqual(200);
      expect(box.y, `${width} px: under the button`).toBeGreaterThanOrEqual(button.y + button.height - 1);
      expect(box.x + box.width, `${width} px: right-aligned to the button`).toBeCloseTo(button.x + button.width, 0);
      expect(box.x, `${width} px: inside the window`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${width} px: inside the window`).toBeLessThanOrEqual(width);
      for (const control of await list(page).locator("a, button").all()) {
        expect((await control.boundingBox())!.height, `${width} px: an entry is a comfortable target`).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test("AC-25: the list is above the page: the first entry is what a click at its centre hits, on the dashboard's map column too", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAsNewUser(page);
    await page.goto("/en/dashboard");
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    await openAccountMenu(page);
    for (const link of await entries(page).all()) {
      const box = (await link.boundingBox())!;
      const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("a")?.textContent ?? "", [box.x + box.width / 2, box.y + box.height / 2]);
      expect(hit).toBe(await link.innerText());
    }
  });

  test("AC-25: the dashboard's fullscreen map covers the account button, as it covers the logo", async ({ page }) => {
    // Without the native Fullscreen API the CSS overlay is all there is: it has to win against the strip's positioned menu.
    await page.addInitScript(() => {
      Object.defineProperty(Element.prototype, "requestFullscreen", { value: undefined, configurable: true });
    });
    await page.setViewportSize({ width: 1280, height: 720 });
    await signInAsNewUser(page);
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    const button = (await accountButton(page).boundingBox())!;
    await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
    await expect(page.getByRole("button", { name: "Exit fullscreen" })).toBeVisible();
    const covered = await page.evaluate(
      ([x, y]) => !!document.elementFromPoint(x, y)?.closest(".fixed.inset-0"),
      [button.x + button.width / 2, button.y + button.height / 2],
    );
    expect(covered).toBe(true);
  });
});