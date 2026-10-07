import { randomUUID } from "node:crypto";
import { expect, type Locator, type Page } from "@playwright/test";
import { psql } from "./local-db";

// Signs in through the dummy login with this email; the account is created on first use (spec 0006 AC-3).
// Posts to the route the form submits to instead of loading the landing page and filling in the form
// (spec 0006 AC-8): the session cookies land in the page's browser context, and the 303 is not followed so
// the dashboard is rendered once, by the goto.
export async function signInWithEmail(page: Page, email: string) {
  const response = await page.request.post("/auth/test-login", { form: { email, locale: "en" }, maxRedirects: 0 });
  const location = response.headers()["location"] ?? "";
  if (response.status() !== 303 || !location.endsWith("/en/dashboard")) {
    throw new Error(`Test login refused: ${response.status()} ${location}`);
  }
  await page.goto("/en/dashboard");
  await expect(page).toHaveURL(/\/en\/dashboard$/);
}

// The same sign-in through the page itself: landing page, email field, button (spec 0006 AC-9).
export async function signInThroughForm(page: Page, email: string) {
  await page.goto("/en");
  await page.getByLabel(/^Test login/).fill(email);
  await page.getByRole("button", { name: "Sign in as test user" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/);
}

// Signs in as a brand-new user (spec 0006 AC-3, AC-6), so every test starts from an empty dashboard
// and tests can run in parallel.
export async function signInAsNewUser(page: Page) {
  const email = `e2e-${randomUUID()}@kektura.test`;
  await signInWithEmail(page, email);
  return email;
}

// The account menu's button (spec 0014 AC-20): a <summary>, named Account in English.
export const accountButton = (page: Page) => page.locator("body > header summary");

// Opens the account menu and returns its list. Waits until the page has hydrated first (the button then carries
// `aria-expanded`, spec 0014 AC-22), so the click is the one the script listens to.
export async function openAccountMenu(page: Page) {
  const button = accountButton(page);
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  return page.locator("body > header details ul");
}

// The value of a dashboard stat card, e.g. stat(page, "Stamps") -> "0 / 161".
export const stat = (page: Page, label: string) =>
  page.locator("dl > div", { has: page.locator("dt", { hasText: new RegExp(`^${label}$`) }) }).locator("dd");

// Opens every stage of the stamps list. Retried until it sticks, which also waits for hydration.
export async function expandAllStages(page: Page) {
  await expect(async () => {
    await page.getByRole("button", { name: "Expand all" }).click();
    await expect(page.locator("#stage-1 [aria-expanded]")).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
  }).toPass();
}

// The page does not scroll sideways (spec 0036 AC-5, spec 0006 AC-10): its scroll width is no wider than the window's
// client width. When it is, the failure names the elements that stick out. Polled, so a page that is still settling
// (fonts, hydration) gets a moment.
export async function expectNoSidewaysScroll(page: Page, message: string) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const width = document.documentElement.clientWidth;
          const wide = [...document.body.querySelectorAll("*")]
            .filter((el) => el.getBoundingClientRect().right > width + 0.5)
            .map((el) => `<${el.tagName.toLowerCase()} class="${el.className}">`);
          return document.documentElement.scrollWidth - width > 0 ? wide.join(" | ") || "page wider than the window" : "";
        }),
      { message },
    )
    .toBe("");
}

// Spec 0001 AC-10: the ids of the place and extra-stamp rows whose description is cut off, nowrap or sticks
// out of its row, plus how many descriptions were measured (so a changed selector can't pass vacuously).
export function measureDescriptions(page: Page) {
  return page.locator("li[id^=place-], #extra-stamps li").evaluateAll((lis) => {
    const rows = lis.flatMap((li) =>
      [...li.querySelectorAll<HTMLElement>("div.text-xs")].map((d) => {
        const s = getComputedStyle(d);
        const clipped =
          s.textOverflow === "ellipsis" ||
          s.whiteSpace === "nowrap" ||
          d.scrollWidth > d.clientWidth ||
          d.getBoundingClientRect().right > li.getBoundingClientRect().right;
        return { id: li.id, clipped };
      }),
    );
    return { measured: rows.length, clipped: rows.filter((r) => r.clipped).map((r) => r.id) };
  });
}

// Switches a feature flag in the local database (spec 0035 AC-11): its mode, and for `allowlist` the users it is on
// for. The change shows on the next request. The flags are global, so a test that changes a declared flag belongs
// in e2e/feature-flags.spec.ts (a project that runs alone, after the others) and puts it back when it is done.
export function setFeatureFlag(key: string, mode: "off" | "allowlist" | "on", allowedEmails: string[] = []) {
  const quote = (text: string) => `'${text.replaceAll("'", "''")}'`;
  psql(
    `update public.feature_flags set mode = ${quote(mode)} where key = ${quote(key)};` +
      `delete from public.feature_flag_users where key = ${quote(key)};` +
      (allowedEmails.length
        ? `insert into public.feature_flag_users (key, user_id) select ${quote(key)}, id from auth.users where email in (${allowedEmails.map(quote).join(", ")});`
        : ""),
  );
}

// The map's canvas (spec 0003): a WebGL element, so stamps are reached through the app's own list -> map flow below.
export const canvas = (page: Page) => page.locator(".maplibregl-canvas");

// A click on 📍 does nothing until the map has loaded and attached its listener (a second or two over the network, more on a busy
// machine), so it is repeated until the label appears on the map. (`.first()`: the label is the only popup until one is clicked open.)
export async function pressLocate(page: Page, button: Locator) {
  await expect(async () => {
    await button.click();
    await expect(page.locator(".maplibregl-popup").filter({ hasText: /\S/ }).first()).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 45_000 });
}

// 📍 on a list row, then a click on the canvas centre until the stamp's popup opens (the fly animation
// and the smooth scroll have to finish first, so the click is retried).
export async function openStampPopup(page: Page, placeKey: string, action: string) {
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

// Stamps places for a user straight in the database, each on its own day (`{ OKTPH_02: "2026-01-25" }`): every variant of the
// place gets a row, as the stamp button would. Faster than clicking, and the only way to put stamps in the past or in many months.
export function stampPlacesOn(email: string, dates: Record<string, string>) {
  for (const [key, day] of Object.entries(dates)) {
    psql(
      `insert into public.user_stamps (user_id, checkpoint_id, stamped_on) select u.id, c.id, '${day}' from auth.users u, public.checkpoints c where u.email = '${email}' and coalesce(c.place_key, c.code) = '${key}' and c.retired_on is null`,
    );
  }
}

// Every place of the first `stages` stages stamped on one day.
export function stampStagesOn(email: string, stages: number, day: string) {
  psql(
    `insert into public.user_stamps (user_id, checkpoint_id, stamped_on) select u.id, c.id, '${day}' from auth.users u, public.checkpoints c where u.email = '${email}' and c.stage <= ${stages} and c.retired_on is null`,
  );
}

// An extra stamp (by its id: 1 is Velem, 3.8 km from the start, in stage 1) on a day.
export function stampExtraOn(email: string, extraId: number, day: string) {
  psql(
    `insert into public.user_extra_stamps (user_id, extra_id, stamped_on) select u.id, ${extraId}, '${day}' from auth.users u where u.email = '${email}'`,
  );
}

// The walk of spec 0037's tests: six months, one of them empty, one with only an extra stamp, and a stretch finished by a
// stamp that is placed next to an earlier month's. Places 01 to 05 are 0, 8.1, 13.0, 28.7 and 38.4 km from the start.
//   Dec 2025: 05 (1 stamp, stage 1, 0 km)      Jan 2026: 01 and 02 (2 stamps, 8.1 km)       Feb: nothing
//   Mar: the extra stamp 1 only                  Apr: 04 (1 stamp, 9.7 km: 04-05 is walked now, 05 is older)
//   May: 03 (1 stamp, 4.9 + 15.7 = 20.6 km: both its stretches are walked now, 02 and 04 are older)
// Together 38.4 km, the dashboard's walked km, and 5 of the 161 places.
export function seedStatsWalk(email: string) {
  stampPlacesOn(email, {
    OKTPH_05: "2025-12-30",
    OKTPH_01_DDKPH_01: "2026-01-20",
    OKTPH_02: "2026-01-25",
    OKTPH_04: "2026-04-02",
    OKTPH_03: "2026-05-10",
  });
  stampExtraOn(email, 1, "2026-03-15");
}
