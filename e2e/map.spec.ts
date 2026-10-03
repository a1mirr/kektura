import { expect, test, type Page } from "@playwright/test";
import { expandAllStages, signInAsNewUser } from "./helpers";

// Spec 0011 AC-1: the map behaviours the DOM allows (spec 0003). The map is a WebGL canvas, so there
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

test.describe("spec 0011 + 0003: the trail map", () => {
  test("0011 AC-1, 0003 AC-9: the map canvas renders with the OpenStreetMap attribution", async ({ page }) => {
    await openDashboardWithMap(page);
    const box = await canvas(page).boundingBox();
    expect(box?.width).toBeGreaterThan(200);
    expect(box?.height).toBeGreaterThan(200);
    await expect(page.locator(".maplibregl-ctrl-attrib")).toContainText("OpenStreetMap");
  });

  test("0011 AC-1, 0003 AC-10: layer toggles have their defaults and persist across a reload", async ({ page }) => {
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

  test("0011 AC-1, 0003 AC-10: the extra stamps toggle (with its count) persists across a reload", async ({ page }) => {
    await openDashboardWithMap(page);
    const extras = mapSection(page).getByLabel(/^Show extra stamps \(\d+\)$/);
    await expect(extras).not.toBeChecked();
    await extras.check();
    await page.reload();
    await expect(canvas(page)).toBeVisible();
    await expect(extras).toBeChecked();
  });

  test("0011 AC-1, 0003 AC-11: fullscreen is entered by its button and left by Esc or the button", async ({ page }) => {
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

  test("0011 AC-1, 0003 AC-13: the 📍 button in a list row scrolls the map into view and labels the stamp", async ({
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

  test("0011 AC-1, 0003 AC-4, AC-8, AC-12: picking two stamps shows the stretch's numbers; Clear removes the panel", async ({
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
});
