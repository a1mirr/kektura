// Run it on a developer machine when the interface changed, then look at the pictures and commit them; it is not part
// of CI (the map needs OpenStreetMap's tiles).
//
//   npm run testdb:start                        (local Supabase, needs Docker)
// npm run build:e2e && npm run start:e2e      (the test server's production build on :3002: no dev overlay in the
// pictures)
//   npm run screenshots                         (SCREENSHOTS_URL=http://localhost:3002 is the default)
//
// Every picture is taken and checked first, and only then are the files written: a page that shows an email address,
// the test server's banner or an error stops the run and leaves the old pictures alone. The banner is part of every
// page of the test server; the script removes it from the page just before the shot, after making sure it was there.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { DEMO_EMAIL, demoSql, pageProblems, pngSize, SIZE } from "./lib/screenshots.mjs";

/** A problem to tell the user about. Thrown, not process.exit(): see the Windows note in CLAUDE.md. */
export class Problem extends Error {}

const messages = JSON.parse(fs.readFileSync(new URL("../messages/en.json", import.meta.url), "utf8"));
const OUT = new URL("../public/screenshots/", import.meta.url);
const BASE = process.env.SCREENSHOTS_URL ?? "http://localhost:3002";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Whether the element shows within `timeout` ms (Locator.isVisible does not wait).
const appears = (locator, timeout = 2_000) => locator.waitFor({ state: "visible", timeout }).then(() => true, () => false);

function psql(sql) {
  return execFileSync("docker", ["exec", "supabase_db_kektura", "psql", "-U", "postgres", "-tA", "-c", sql], { encoding: "utf8" });
}

// The framing of the map pictures (place keys of scripts/data, mouse-wheel steps out from the zoom the 📍 button gives).
const MAP_CENTRE = "OKTPH_22"; // Gyöngyösi csárda, between the walked and the unwalked part
const MAP_ZOOM_OUT = 9;
const FROM = "OKTPH_27"; // Tapolca: where the demo walk ends
const TO = "OKTPH_30"; // Badacsonytördemic
const ROUTE_ZOOM_OUT = 2;

const canvas = (page) => page.locator(".maplibregl-canvas");

async function mapSettled(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  let before = "";
  for (let i = 0; i < 20; i++) {
    await wait(700);
    const now = await canvas(page).evaluate((el) => el.toDataURL?.().length ?? 0).catch(() => 0);
    if (String(now) === before) return;
    before = String(now);
  }
}

// 📍 on a place's row, then a click on the canvas centre until the stamp's popup shows the action (the same flow as
// the E2E helper `openStampPopup`: the fly animation and the smooth scroll have to finish first).
async function openStampPopup(page, placeKey, action) {
  const button = page.locator(`#place-${placeKey}`).getByRole("button", { name: "Show on map" });
  for (let attempt = 0; attempt < 30; attempt++) {
    await button.click();
    const label = page.locator(".maplibregl-popup").filter({ hasText: /\S/ }).last();
    if (!(await appears(label))) continue;
    let before = await label.boundingBox();
    for (let i = 0; i < 20; i++) {
      await wait(500);
      const now = await label.boundingBox();
      if (JSON.stringify(now) === JSON.stringify(before)) break;
      before = now;
    }
    const size = await canvas(page).evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }));
    await canvas(page).click({ position: { x: size.w / 2, y: size.h / 2 } });
    if (await appears(page.getByRole("button", { name: action }))) return;
  }
  throw new Problem(`The popup of ${placeKey} with "${action}" did not open.`);
}

async function showPlace(page, placeKey) {
  const button = page.locator(`#place-${placeKey}`).getByRole("button", { name: "Show on map" });
  for (let attempt = 0; attempt < 30; attempt++) {
    await button.click();
    if (await appears(page.locator(".maplibregl-popup").filter({ hasText: /\S/ }).first())) return;
  }
  throw new Problem(`The map did not show ${placeKey}.`);
}

// The popup's button, pressed without moving the mouse: on a phone the map's attribution can lie over it.
const popupAction = (page, name) => page.getByRole("button", { name }).dispatchEvent("click");

async function closePopups(page) {
  for (const close of await page.locator(".maplibregl-popup-close-button").all()) await close.click().catch(() => {});
  await page.evaluate(() => document.querySelectorAll(".maplibregl-popup").forEach((el) => el.remove()));
}

async function zoomOut(page, steps, delta = 240) {
  const box = await canvas(page).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, delta);
    await wait(400);
  }
}

// Checks the page as it is about to be photographed, then removes the test server's banner from it (see the top of the file). A page
// that was just loaded must still have the banner: without it this is not the test server.
async function inspect(page, what, { freshPage }) {
  const banner = messages.app.testBanner;
  const text = () => page.evaluate(() => document.body.innerText);
  if (freshPage && !(await text()).includes(banner)) throw new Problem(`${what}: the test server's banner is missing: this is not the test server.`);
  await page.evaluate((message) => {
    for (const el of document.querySelectorAll("body > [role=status]")) if (el.textContent?.includes(message)) el.remove();
  }, banner);
  const problems = pageProblems({
    text: await text(),
    alerts: await page.evaluate(() => document.querySelectorAll("[role=alert]").length), // not Playwright's locator: it looks inside shadow roots, where Next's route announcer lives
    banner,
    errors: [messages.error.title, messages.home.authError],
  });
  if (problems.length) throw new Problem(`${what}: ${problems.join("; ")}.`);
}

async function shoot(page, name, shots, freshPage = true) {
  await inspect(page, name, { freshPage });
  const png = await page.screenshot({ type: "png" });
  const { width, height } = pngSize(png);
  if (width !== SIZE.width || height !== SIZE.height) throw new Problem(`${name}: the picture is ${width} x ${height}, not ${SIZE.width} x ${SIZE.height}.`);
  shots.set(name, png);
}

export async function takeScreenshots() {
  const { chromium, request } = await import("@playwright/test"); // loaded here, so a test can import this file without it
  const probe = await request.newContext({ baseURL: BASE });
  const up = await probe.get("/en").then((r) => r.ok(), () => false);
  await probe.dispose();
  if (!up) {
    throw new Problem(
      `Nothing answers at ${BASE}. Start the test server first (needs Docker):\n  npm run testdb:start\n  npm run build:e2e && npm run start:e2e\nor set SCREENSHOTS_URL.`,
    );
  }

  const browser = await chromium.launch();
  const shots = new Map();
  try {
    const context = await browser.newContext({
      baseURL: BASE,
      locale: "en-US",
      viewport: { width: SIZE.width / SIZE.scale, height: SIZE.height / SIZE.scale },
      deviceScaleFactor: SIZE.scale,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    const login = await page.request.post("/auth/test-login", { form: { email: DEMO_EMAIL, locale: "en" }, maxRedirects: 0 });
    if (login.status() !== 303 || !(login.headers()["location"] ?? "").endsWith("/en/dashboard")) {
      throw new Problem(`The dummy login was refused (${login.status()}): ${BASE} is not a test server.`);
    }
    psql(demoSql());

    await page.goto("/en/dashboard");
    await page.getByRole("button", { name: "Expand all" }).waitFor();
    await page.addStyleTag({ content: "[data-sticky-map] { display: none !important; }" });
    await page.getByRole("button", { name: "Expand all" }).click();
    await page.waitForFunction(() => document.querySelector("#stage-1 [aria-expanded]")?.getAttribute("aria-expanded") === "true");
    await page.getByRole("button", { name: "Collapse all" }).click();
    await page.locator("#stage-3 [aria-expanded]").click();
    await page.waitForFunction(() => document.querySelector("#stage-3 [aria-expanded]")?.getAttribute("aria-expanded") === "true");
    await page.evaluate(() => window.scrollTo(0, 0));
    await wait(500);
    await shoot(page, "dashboard", shots);

    await page.goto("/en/dashboard");
    await page.getByRole("button", { name: "Expand all" }).click();
    await page.waitForFunction(() => document.querySelector("#stage-1 [aria-expanded]")?.getAttribute("aria-expanded") === "true");
    await canvas(page).waitFor();
    await showPlace(page, MAP_CENTRE);
    await closePopups(page);
    await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
    await page.getByRole("button", { name: "Exit fullscreen" }).waitFor();
    await zoomOut(page, MAP_ZOOM_OUT, 600);
    await mapSettled(page);
    await shoot(page, "map", shots);

    await page.getByRole("button", { name: "Exit fullscreen" }).click();
    await openStampPopup(page, FROM, "Route from here");
    await popupAction(page, "Route from here");
    await openStampPopup(page, TO, "Route to here");
    await popupAction(page, "Route to here");
    await page.getByText(/^Distance:/).waitFor();
    await closePopups(page);
    await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
    await page.getByRole("button", { name: "Exit fullscreen" }).waitFor();
    await zoomOut(page, ROUTE_ZOOM_OUT);
    await mapSettled(page);
    await shoot(page, "route", shots, false); // the same page as the map's: its banner is gone already
  } finally {
    await browser.close();
  }
  return shots;
}
// Takes every picture first and writes the files only when all of them are good, so a broken run leaves the old pictures alone.
export async function main({ take = takeScreenshots, out = OUT } = {}) {
  const shots = await take();
  fs.mkdirSync(out, { recursive: true });
  for (const [name, png] of shots) fs.writeFileSync(new URL(`${name}.png`, out), png);
  console.log(`Wrote ${[...shots.keys()].join(", ")} to public/screenshots/. Look at them before you commit them.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    if (!(error instanceof Problem)) throw error;
    console.error(error.message);
    process.exitCode = 1;
  }
}
