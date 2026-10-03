import { expect, test, type Page } from "@playwright/test";
import { expandAllStages, signInAsNewUser, stat } from "./helpers";

// Spec 0003: the map behaviours the DOM allows. The map is a WebGL canvas, so there
// is no pixel clicking on stamps except through the app's own list -> map flow: the 📍 button flies
// the map to a stamp and centres it, so a click on the canvas centre hits that stamp's dot.

const canvas = (page: Page) => page.locator(".maplibregl-canvas");
const mapSection = (page: Page) => page.locator("section", { has: canvas(page) });

async function openDashboardWithMap(page: Page) {
  await signInAsNewUser(page);
  // The map is created after hydration, so a visible canvas also means the toggles are interactive.
  await expect(canvas(page)).toBeVisible();
}

// 📍 on a list row, then a click on the canvas centre until the stamp's popup opens (the fly animation
// and the smooth scroll have to finish first, so the click is retried).
async function openStampPopup(page: Page, placeKey: string, action: string) {
  await page.locator(`#place-${placeKey}`).getByRole("button", { name: "Show on map" }).click();
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

  test("AC-13: the 📍 button in a list row scrolls the map into view and labels the stamp", async ({
    page,
  }) => {
    await openDashboardWithMap(page);
    await expandAllStages(page);

    const row = page.locator("#place-OKTPH_149");
    await row.scrollIntoViewIfNeeded();
    await expect(canvas(page)).not.toBeInViewport();

    await row.getByRole("button", { name: "Show on map" }).click();
    await expect(canvas(page)).toBeInViewport();
    await expect(page.locator(".maplibregl-popup")).toContainText("Hollóháza");
  });

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

  test("AC-12: a failed save keeps the popup open with the error and a working button; the next try marks the stamp and closes it", async ({
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

    await page.locator("#place-OKTPH_02").getByRole("button", { name: "Show on map" }).click(); // flies to zoom 12 or more
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
    await page.locator("#extra-stamps li").first().getByRole("button", { name: "Show on map" }).click();
    await expect(extras).toBeChecked();
    await expect(canvas(page)).toBeInViewport();
  });

  test("AC-16: stamping from the list keeps the map where it is", async ({ page }) => {
    await openDashboardWithMap(page);
    await expandAllStages(page);
    await page.locator("#place-OKTPH_02").getByRole("button", { name: "Show on map" }).click();
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
