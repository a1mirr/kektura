import { expect, test, type Locator, type Page } from "@playwright/test";
import { expandAllStages, signInAsNewUser, stat } from "./helpers";

// Spec 0003: the map behaviours the DOM allows. The map is a WebGL canvas, so there
// is no pixel clicking on stamps except through the app's own list -> map flow: the 📍 button flies
// the map to a stamp and centres it, so a click on the canvas centre hits that stamp's dot.

// The page may not scroll sideways (spec 0036 AC-5).
const expectNoSideways = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

const canvas = (page: Page) => page.locator(".maplibregl-canvas");
const mapSection = (page: Page) => page.locator("section", { has: canvas(page) });

async function openDashboardWithMap(page: Page) {
  await signInAsNewUser(page);
  // The map is created after hydration, so a visible canvas also means the toggles are interactive.
  await expect(canvas(page)).toBeVisible();
  // The list -> map listeners are attached when the map has loaded its first tiles, which takes a second or two over the network:
  // a click on 📍 before that does nothing. The tile requests are done when the network is quiet.
  await page.waitForLoadState("networkidle");
}

// A click on 📍 does nothing until the map has loaded and attached its listener (a second or two over the network, more on a busy
// machine), so it is repeated until the label appears on the map. (`.first()`: the label is the only popup until one is clicked open.)
async function pressLocate(page: Page, button: Locator) {
  await expect(async () => {
    await button.click();
    await expect(page.locator(".maplibregl-popup").filter({ hasText: /\S/ }).first()).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 45_000 });
}

// 📍 on a list row, then a click on the canvas centre until the stamp's popup opens (the fly animation
// and the smooth scroll have to finish first, so the click is retried).
async function openStampPopup(page: Page, placeKey: string, action: string) {
  await pressLocate(page, page.locator(`#place-${placeKey}`).getByRole("button", { name: "Show on map" }));
  // The stamp's name label sits on the dot: once it stops moving the fly animation and the scroll are
  // over (a click during the flight would interrupt it and miss the dot).
  const label = page.locator(".maplibregl-popup").filter({ hasText: /\S/ }).last();
  await expect(label).toBeVisible();
  await expect(async () => {
    const before = await label.boundingBox();
    await page.waitForTimeout(500);
    expect(await label.boundingBox()).toEqual(before);
  }).toPass();
  const size = await canvas(page).evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }));
  await canvas(page).click({ position: { x: size.w / 2, y: size.h / 2 } });
  await expect(page.getByRole("button", { name: action })).toBeVisible();
}

test.describe("spec 0003: the trail map", () => {
  test("AC-9: the map canvas renders with the OpenStreetMap attribution", async ({ page }) => {
    await openDashboardWithMap(page);
    const box = await canvas(page).boundingBox();
    expect(box?.width).toBeGreaterThan(200);
    expect(box?.height).toBeGreaterThan(200);
    await expect(page.locator(".maplibregl-ctrl-attrib")).toContainText("OpenStreetMap");
    // its links are told apart from the text around them by more than their colour (spec 0006 AC-11: axe's link-in-text-block)
    const decorations = await page.locator(".maplibregl-ctrl-attrib a").evaluateAll((links) => links.map((a) => getComputedStyle(a).textDecorationLine));
    expect(decorations.length).toBeGreaterThan(0);
    expect(decorations.filter((line) => line !== "underline")).toEqual([]);
  });

  test("AC-10: layer toggles have their defaults and persist across a reload", async ({ page }) => {
    await openDashboardWithMap(page);
    const section = mapSection(page);
    const walked = section.getByLabel("Walked stretches");
    const stamps = section.getByLabel("Stamps", { exact: true });
    const restaurants = section.getByLabel(/^Show restaurants \(\d+\)$/);

    await expect(walked).toBeChecked(); // on by default
    await expect(stamps).toBeChecked(); // on by default
    await expect(restaurants).not.toBeChecked(); // off by default, shown once its data has loaded

    await walked.uncheck();
    await stamps.uncheck();
    await restaurants.check();

    await page.reload();
    await expect(canvas(page)).toBeVisible();
    await expect(walked).not.toBeChecked();
    await expect(stamps).not.toBeChecked();
    await expect(restaurants).toBeChecked();

    await walked.check();
    await page.reload();
    await expect(canvas(page)).toBeVisible();
    await expect(walked).toBeChecked();
  });

  test("AC-10: the extra stamps toggle (with its count) persists across a reload", async ({ page }) => {
    await openDashboardWithMap(page);
    const extras = mapSection(page).getByLabel(/^Show extra stamps \(\d+\)$/);
    await expect(extras).not.toBeChecked();
    await extras.check();
    await page.reload();
    await expect(canvas(page)).toBeVisible();
    await expect(extras).toBeChecked();
  });

  test("AC-11: fullscreen is entered by its button and left by Esc or the button", async ({ page }) => {
    await openDashboardWithMap(page);
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");

    await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
    await expect(page.getByRole("button", { name: "Exit fullscreen" })).toBeVisible();
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");

    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Fullscreen", exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");

    await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
    await expect(page.getByRole("button", { name: "Exit fullscreen" })).toBeVisible();
    await page.getByRole("button", { name: "Exit fullscreen" }).click();
    await expect(page.getByRole("button", { name: "Fullscreen", exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });

  test("AC-11: in two columns the fullscreen map is the topmost thing everywhere, over the stamped rows of the other column too", async ({
    page,
  }) => {
    // Without the native Fullscreen API the CSS overlay is all there is, and it is the overlay that has to win the stacking
    // against the sticky block it sits in and against the positioned controls of the right one (the date fields).
    await page.addInitScript(() => {
      Object.defineProperty(Element.prototype, "requestFullscreen", { value: undefined, configurable: true });
    });
    await openDashboardWithMap(page); // the default window is 1280 x 720: two columns
    await expandAllStages(page);
    const row = page.locator("#place-OKTPH_01_DDKPH_01");
    await row.getByRole("button", { name: "Add stamp" }).click();
    const calendar = row.locator("span.relative.inline-flex"); // the date field's calendar button, a positioned element
    await expect(calendar).toBeVisible();
    await calendar.scrollIntoViewIfNeeded();

    await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
    await expect(page.getByRole("button", { name: "Exit fullscreen" })).toBeVisible();
    const at = await calendar.boundingBox();
    const hits = await page.evaluate((box) => {
      const points = [
        [box!.x + box!.width / 2, box!.y + box!.height / 2], // right where the calendar button is
        [2, 2],
        [innerWidth - 2, 2],
        [2, innerHeight - 2],
        [innerWidth - 2, innerHeight - 2],
        [innerWidth / 2, innerHeight / 2],
      ];
      return points.map(([x, y]) => !!document.elementFromPoint(x, y)?.closest(".fixed.inset-0"));
    }, at);
    expect(hits).toEqual([true, true, true, true, true, true]);
    expect(at!.y).toBeGreaterThan(0); // the row's control really was in the window, under the overlay
    expect(at!.y).toBeLessThan(720);
  });

  test("AC-24: with the route panel shown the map's block scrolls inside itself and the map stays visible", async ({ page }) => {
    await openDashboardWithMap(page); // 1280 x 720
    await expandAllStages(page);
    await openStampPopup(page, "OKTPH_01_DDKPH_01", "Route from here");
    await page.getByRole("button", { name: "Route from here" }).click();
    await expect(page.getByText("Now pick the end stamp")).toBeVisible();

    const aside = page.locator("[data-sticky-map]");
    const { scroll, client, overflowY } = await aside.evaluate((el) => ({
      scroll: el.scrollHeight,
      client: el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
    }));
    expect(overflowY).toBe("auto");
    expect(client).toBeLessThanOrEqual(720); // never taller than the window
    await expect(canvas(page)).toBeInViewport();
    expect(scroll).toBeGreaterThanOrEqual(client);
    // whatever does not fit can be scrolled to: the last control of the block, the layer toggles
    await aside.evaluate((el) => (el.scrollTop = el.scrollHeight));
    await expect(page.getByLabel("Walked stretches")).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("button", { name: "Clear", exact: true })).toBeVisible();
    await expectNoSideways(page);
  });

  test("AC-13: the 📍 button brings the map back into view when the block it sits in has been scrolled so that the map is cut off", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 600 }); // short enough that the route panel makes the block scroll over the map
    await openDashboardWithMap(page);
    await expandAllStages(page);
    await openStampPopup(page, "OKTPH_01_DDKPH_01", "Route from here");
    await page.getByRole("button", { name: "Route from here" }).click();
    await expect(page.getByText("Now pick the end stamp")).toBeVisible();

    const block = page.locator("[data-sticky-map]");
    await page.evaluate(() => window.scrollTo(0, 1500)); // the block sticks
    await block.evaluate((el) => (el.scrollTop = el.scrollHeight));
    const [blockBox, cutOff] = [(await block.boundingBox())!, (await canvas(page).boundingBox())!];
    expect(cutOff.y, "the map's top is hidden by the block").toBeLessThan(blockBox.y);

    await page.locator("#place-OKTPH_149").scrollIntoViewIfNeeded();
    const scrolled = await page.evaluate(() => window.scrollY);
    await pressLocate(page, page.locator("#place-OKTPH_149").getByRole("button", { name: "Show on map" }));
    await expect
      .poll(async () => {
        const [b, c] = [(await block.boundingBox())!, (await canvas(page).boundingBox())!];
        return c.y >= b.y && c.y + c.height <= b.y + b.height;
      }, { message: "the map ends fully inside its block" })
      .toBe(true);
    await expect(canvas(page)).toBeInViewport({ ratio: 1 });
    await page.waitForTimeout(500); // the list did not move: only the block scrolled
    expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
  });

  for (const locale of ["en", "hu", "de", "ru"]) {
    for (const [width, height] of [
      [1280, 720],
      [1024, 768],
    ]) {
      test(`AC-24: in ${locale} at ${width} x ${height} nothing of the map's block is cut off without a way to scroll to it`, async ({ page }) => {
        await signInAsNewUser(page);
        await page.setViewportSize({ width, height });
        await page.goto(`/${locale}/dashboard`);
        await expect(canvas(page)).toBeVisible();
        const aside = page.locator("[data-sticky-map]");
        await page.evaluate(() => window.scrollTo(0, 1500)); // the block sticks once the page has scrolled
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
        const m = await aside.evaluate((el) => {
          const box = el.getBoundingClientRect();
          el.scrollTop = el.scrollHeight;
          const last = el.lastElementChild!.getBoundingClientRect();
          return {
            wide: el.scrollWidth - el.clientWidth, // nothing sticks out sideways
            tall: el.scrollHeight - el.clientHeight, // above 0: it scrolls
            overflowY: getComputedStyle(el).overflowY,
            lastBottomInside: last.bottom <= box.bottom + 1, // after scrolling to the end the last block is in view
            asideInWindow: box.bottom <= innerHeight + 0.5,
          };
        });
        expect(m.wide, "sideways").toBeLessThanOrEqual(0);
        expect(m.asideInWindow).toBe(true);
        expect(m.tall <= 0 || m.overflowY === "auto", "it fits, or it scrolls").toBe(true);
        expect(m.lastBottomInside, "the end of the block can be reached").toBe(true);
      });
    }
  }

  test("AC-13: in one column the 📍 button in a list row scrolls the map into view and labels the stamp", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 720 }); // below 1024 px the map is not sticky (spec 0001 AC-28)
    await openDashboardWithMap(page);
    await expandAllStages(page);

    const row = page.locator("#place-OKTPH_149");
    await row.scrollIntoViewIfNeeded();
    await expect(canvas(page)).not.toBeInViewport();

    await pressLocate(page, row.getByRole("button", { name: "Show on map" }));
    await expect(canvas(page)).toBeInViewport();
    await expect(page.locator(".maplibregl-popup")).toContainText("Hollóháza");
  });

  test("AC-13: in two columns the map is in view already, so the 📍 button only flies it to the stamp and labels it", async ({
    page,
  }) => {
    await openDashboardWithMap(page); // the default window is 1280 x 720: two columns, the map sticky
    await expandAllStages(page);

    const row = page.locator("#place-OKTPH_149");
    await row.scrollIntoViewIfNeeded();
    await expect(canvas(page)).toBeInViewport({ ratio: 1 });
    const before = (await row.boundingBox())!;

    await pressLocate(page, row.getByRole("button", { name: "Show on map" }));
    await expect(canvas(page)).toBeInViewport({ ratio: 1 });
    await expect(page.locator(".maplibregl-popup")).toContainText("Hollóháza");
    await page.waitForTimeout(1000); // a smooth scroll of the page would have moved the row by now
    // the map was in view already, so the click must not scroll the list from under the pointer
    expect((await row.boundingBox())!.y, "the row did not move").toBeCloseTo(before.y, 0);
  });

  for (const [width, layout] of [
    [1280, "two columns"],
    [768, "one column"],
  ] as const) {
    test(`AC-12: in ${layout} "Show in list" in a stamp's popup brings its row into view and flashes it`, async ({ page }) => {
      await page.setViewportSize({ width, height: 720 });
      await openDashboardWithMap(page);
      await expandAllStages(page);
      const row = page.locator("#place-OKTPH_149"); // the last stage: far down the list
      await row.getByRole("button", { name: "Add stamp" }).click(); // a stamped row, with its date controls
      await expect(row.getByRole("button", { name: "Remove" })).toBeVisible();
      await openStampPopup(page, "OKTPH_149", "Show in list");
      if (width >= 1024) {
        await page.evaluate(() => window.scrollTo(0, 1500)); // the row is far out of view, the sticky map is not
        await expect(row).not.toBeInViewport();
        await expect(page.getByRole("button", { name: "Show in list" })).toBeInViewport();
      }
      await page.getByRole("button", { name: "Show in list" }).click();

      await expect(row).toBeInViewport({ ratio: 1 });
      await expect(row).toHaveClass(/flash/);
      if (width >= 1024) {
        // two columns: the map did not leave the window while the list moved, and the block stays inside it
        await expect(canvas(page)).toBeInViewport({ ratio: 1 });
        const aside = (await page.locator("[data-sticky-map]").boundingBox())!;
        expect(aside.y + aside.height).toBeLessThanOrEqual(720 + 0.5);
      }
    });
  }

  test("AC-4, AC-8, AC-12: picking two stamps shows the stretch's numbers; Clear removes the panel", async ({
    page,
  }) => {
    await openDashboardWithMap(page);
    await expandAllStages(page);

    await openStampPopup(page, "OKTPH_01_DDKPH_01", "Route from here"); // Írott-kő
    await page.getByRole("button", { name: "Route from here" }).click();
    await expect(page.getByText("Now pick the end stamp")).toBeVisible();

    await openStampPopup(page, "OKTPH_02", "Route to here"); // Hét-forrás
    await page.getByRole("button", { name: "Route to here" }).click();

    // First hop of the MTSZ table: 8.2 km, +125 m / -570 m, 130 minutes west -> east.
    const panel = page.locator("div.bg-amber-50");
    await expect(panel).toContainText("Írott-kő → Hét-forrás");
    await expect(panel).toContainText("Distance: 8.2 km");
    await expect(panel).toContainText("ascent 125 m");
    await expect(panel).toContainText("descent 570 m");
    await expect(panel).toContainText("time ~2:10");

    await panel.getByRole("button", { name: "Clear" }).click();
    await expect(panel).toHaveCount(0);
  });

  test("AC-12: a failed save keeps the popup open with the error and a working button; the next try marks the stamp, and the popup of a marked stamp unmarks it", async ({
    page,
  }) => {
    await openDashboardWithMap(page);
    await expandAllStages(page);

    await openStampPopup(page, "OKTPH_01_DDKPH_01", "Mark as walked");
    // Server actions are POSTs to the page: refuse them, as a lost connection would.
    await page.route("**/en/dashboard", (route) => (route.request().method() === "POST" ? route.abort() : route.continue()));
    await page.getByRole("button", { name: "Mark as walked" }).dispatchEvent("click"); // the popup's buttons overlap in the small test window
    await expect(page.locator(".maplibregl-popup").getByText("Couldn't save, try again.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark as walked" })).toBeEnabled();
    await expect(stat(page, "Stamps")).toHaveText("0 / 161");

    await page.unroute("**/en/dashboard");
    await page.getByRole("button", { name: "Mark as walked" }).dispatchEvent("click"); // the popup's buttons overlap in the small test window
    await expect(page.getByRole("button", { name: "Mark as walked" })).toHaveCount(0); // the popup closed
    await expect(stat(page, "Stamps")).toHaveText("1 / 161");

    // The popup of a marked stamp unmarks it.
    await openStampPopup(page, "OKTPH_01_DDKPH_01", "Remove mark");
    await page.getByRole("button", { name: "Remove mark" }).dispatchEvent("click");
    await expect(page.getByRole("button", { name: "Remove mark" })).toHaveCount(0);
    await expect(stat(page, "Stamps")).toHaveText("0 / 161");
  });

  test("AC-9: the detailed route is requested once, on first need (zoom 9 or more), and again after a failed load on the next zoom change", async ({
    page,
  }) => {
    const detail = "**/data/okt-route-detail.json";
    let requests = 0;
    let refuse = true;
    await page.route(detail, (route) => {
      requests += 1;
      return refuse ? route.abort() : route.continue();
    });
    await openDashboardWithMap(page);
    await expandAllStages(page);
    expect(requests).toBe(0); // the overview is enough at the start

    const locate = page.locator("#place-OKTPH_02").getByRole("button", { name: "Show on map" });
    await expect(async () => {
      await locate.click(); // flies to zoom 12 or more; repeated until the map has loaded and listens
      expect(requests).toBeGreaterThanOrEqual(1);
    }).toPass({ timeout: 45_000 });
    await expect.poll(() => requests).toBe(1); // refused: the map stays on the overview

    refuse = false;
    await page.locator(".maplibregl-ctrl-zoom-in").click(); // the next zoom change retries
    await expect.poll(() => requests).toBe(2);

    await page.locator(".maplibregl-ctrl-zoom-in").click();
    await page.locator(".maplibregl-ctrl-zoom-out").click();
    await page.waitForTimeout(1_000);
    expect(requests).toBe(2); // loaded: never requested again
  });

  test("AC-13: pressing 📍 on an extra stamp's row switches the extra stamps layer on", async ({ page }) => {
    await openDashboardWithMap(page);
    const extras = mapSection(page).getByLabel(/^Show extra stamps \(\d+\)$/);
    await expect(extras).not.toBeChecked();
    const locate = page.locator("#extra-stamps li").first().getByRole("button", { name: "Show on map" });
    await expect(async () => {
      await locate.click(); // repeated until the map has loaded and listens
      await expect(extras).toBeChecked({ timeout: 2_000 });
    }).toPass({ timeout: 45_000 });
    await expect(canvas(page)).toBeInViewport();
  });

  test("AC-16: stamping from the list keeps the map where it is", async ({ page }) => {
    await openDashboardWithMap(page);
    await expandAllStages(page);
    await pressLocate(page, page.locator("#place-OKTPH_02").getByRole("button", { name: "Show on map" }));
    const label = page.locator(".maplibregl-popup").filter({ hasText: /\S/ }).last();
    await expect(label).toBeVisible();
    await expect(async () => {
      const before = await label.boundingBox();
      await page.waitForTimeout(500);
      expect(await label.boundingBox()).toEqual(before);
    }).toPass();
    const onCanvas = async () => {
      const [l, c] = [await label.boundingBox(), await canvas(page).boundingBox()];
      return { x: l!.x - c!.x, y: l!.y - c!.y };
    };
    const before = await onCanvas();

    await page.locator("#place-OKTPH_02").getByRole("button", { name: "Add stamp" }).click();
    await expect(stat(page, "Stamps")).toHaveText("1 / 161");
    await page.waitForTimeout(500); // the refreshed page has had time to reach the map
    await expect(label).toBeVisible(); // a new map would have lost the stamp's label
    expect(await onCanvas()).toEqual(before); // same position and zoom
  });

  test("AC-12: with an expired session the popup's action sends the visitor to the landing page", async ({ page }) => {
    await openDashboardWithMap(page);
    await expandAllStages(page);
    await openStampPopup(page, "OKTPH_01_DDKPH_01", "Mark as walked");
    await page.context().clearCookies(); // the session is gone, as after signing out in another tab
    await page.getByRole("button", { name: "Mark as walked" }).dispatchEvent("click");
    await expect(page).toHaveURL(/\/en$/);
  });
});
