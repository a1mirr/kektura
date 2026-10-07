import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type en from "../messages/en.json";
import { routing } from "../src/i18n/routing";
import { SCREENSHOT_SIZE, SCREENSHOTS } from "../src/lib/screenshots";
import { expectNoSidewaysScroll, signInAsNewUser } from "./helpers";

// Spec 0038: the landing page's gallery of screenshots. The expected texts are read from each language's own messages file.
type Messages = typeof en;
const messages = (locale: string): Messages =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", `${locale}.json`), "utf8"));

const figures = (page: Page) => page.getByRole("region", { name: /./ }).getByRole("figure");
const box = async (locator: ReturnType<Page["locator"]>) => (await locator.boundingBox())!;

// Scrolls the whole page once, so the lazy pictures are asked for, then waits until each one has been drawn.
async function loadAllPictures(page: Page) {
  for (const figure of await figures(page).all()) {
    await figure.scrollIntoViewIfNeeded();
    await expect(figure.getByRole("img")).toHaveJSProperty("complete", true);
  }
}

test.describe("spec 0038: the landing page's gallery", () => {
  test("AC-1, AC-2: three figures below the sign-in button, in the order dashboard, map, route planner, each with a caption and an alternative text", async ({ page }) => {
    await page.goto("/en");
    const t = messages("en").home.screenshots;
    const region = page.getByRole("region", { name: t.heading });
    await expect(region.getByRole("heading", { level: 2 })).toHaveText(t.heading);
    await expect(region.getByText(t.note)).toBeVisible();
    await expect(region.getByRole("figure")).toHaveCount(3);
    await expect(region.getByRole("img")).toHaveCount(3);
    for (const [i, name] of SCREENSHOTS.entries()) {
      const figure = region.getByRole("figure").nth(i);
      await expect(figure.getByRole("img")).toHaveAttribute("alt", t[`${name}Alt`]);
      await expect(figure.locator("figcaption")).toHaveText(t[`${name}Caption`]);
      await expect(figure.getByRole("img")).toHaveAttribute("src", new RegExp(`url=${encodeURIComponent(`/screenshots/${name}.png`)}&`));
    }
    const button = await box(page.getByRole("button", { name: "Sign in with Google" }));
    expect((await box(region)).y, "the gallery starts below the sign-in button").toBeGreaterThan(button.y + button.height);
  });

  test("AC-1, AC-4: every picture is drawn once it is reached", async ({ page }) => {
    await page.goto("/en");
    await loadAllPictures(page);
    for (const image of await figures(page).getByRole("img").all()) {
      expect(await image.evaluate((el: HTMLImageElement) => [el.naturalWidth > 0, el.currentSrc.includes("/_next/image")])).toEqual([true, true]);
    }
  });

  for (const locale of routing.locales) {
    test(`AC-2: in ${locale} the texts are in the visitor's language and the pictures are the English set`, async ({ page }) => {
      await page.goto(`/${locale}`);
      const t = messages(locale).home.screenshots;
      const region = page.getByRole("region", { name: t.heading });
      await expect(region.getByText(t.note)).toBeVisible();
      for (const [i, name] of SCREENSHOTS.entries()) {
        const figure = region.getByRole("figure").nth(i);
        await expect(figure.getByRole("img")).toHaveAttribute("alt", t[`${name}Alt`]);
        await expect(figure.locator("figcaption")).toHaveText(t[`${name}Caption`]);
        await expect(figure.getByRole("img")).toHaveAttribute("src", new RegExp(`url=${encodeURIComponent(`/screenshots/${name}.png`)}&`)); // one set of files
      }
    });
  }

  test("AC-4: each picture carries its size and loads lazily, and the server sends it as WebP at the size asked for", async ({ page }) => {
    const served = page.waitForResponse((r) => r.url().includes("/_next/image") && r.url().includes("dashboard.png"));
    await page.goto("/en");
    for (const image of await figures(page).getByRole("img").all()) {
      await expect(image).toHaveAttribute("width", String(SCREENSHOT_SIZE.width));
      await expect(image).toHaveAttribute("height", String(SCREENSHOT_SIZE.height));
      await expect(image).toHaveAttribute("loading", "lazy");
    }
    const response = await served;
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/webp");
    const original = fs.statSync(path.join(process.cwd(), "public", "screenshots", "dashboard.png")).size;
    expect((await response.body()).length, "smaller than the file in the repository").toBeLessThan(original);
  });

  test("AC-5: the headline, the subtitle and the sign-in button are on the first screen of a phone (375 x 667), whatever the pictures do", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.route("**/_next/image*", (route) => route.abort()); // pictures that never arrive
    await page.goto("/en");
    const t = messages("en").home;
    for (const target of [page.getByRole("heading", { level: 1 }), page.getByText(t.subtitle), page.getByRole("button", { name: t.signIn })]) {
      await expect(target).toBeInViewport({ ratio: 1 });
    }
  });

  for (const locale of routing.locales) {
    test(`AC-5: in ${locale} the headline, the subtitle and the sign-in button are on the first screen of a phone`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`/${locale}`);
      const t = messages(locale).home;
      for (const target of [page.getByRole("heading", { level: 1 }), page.getByText(t.subtitle), page.getByRole("button", { name: t.signIn })]) {
        await expect(target).toBeInViewport({ ratio: 1 });
      }
    });

    test(`AC-6: in ${locale} the page does not scroll sideways from 320 px up`, async ({ page }) => {
      for (const width of [320, 375, 768, 1024, 1920]) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`/${locale}`);
        await loadAllPictures(page);
        await expectNoSidewaysScroll(page, `sideways scroll at ${width} px on the landing page in ${locale}`);
      }
    });
  }

  test("AC-6: one column below 768 px, three columns from 768 px, and the pictures keep their shape", async ({ page }) => {
    for (const width of [320, 375, 767]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/en");
      const [a, b, c] = [await box(figures(page).nth(0)), await box(figures(page).nth(1)), await box(figures(page).nth(2))];
      expect(b.x, `${width} px: second under first`).toBeCloseTo(a.x, 0);
      expect(c.x, `${width} px: third under second`).toBeCloseTo(a.x, 0);
      expect(b.y, `${width} px`).toBeGreaterThan(a.y + a.height);
      expect(c.y, `${width} px`).toBeGreaterThan(b.y + b.height);
    }
    for (const width of [768, 1024, 1920]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/en");
      const [a, b, c] = [await box(figures(page).nth(0)), await box(figures(page).nth(1)), await box(figures(page).nth(2))];
      expect(b.y, `${width} px: side by side`).toBeCloseTo(a.y, 0);
      expect(c.y, `${width} px`).toBeCloseTo(a.y, 0);
      expect(b.x, `${width} px`).toBeGreaterThan(a.x + a.width);
      expect(c.x, `${width} px`).toBeGreaterThan(b.x + b.width);
    }
    const image = await box(figures(page).first().getByRole("img"));
    expect(image.height / image.width, "the picture's shape").toBeCloseTo(SCREENSHOT_SIZE.height / SCREENSHOT_SIZE.width, 1);
  });

  test("AC-7: the footer comes after the gallery, below the first screen", async ({ page }) => {
    for (const [width, height] of [
      [375, 667],
      [1280, 720],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto("/en");
      const last = await box(figures(page).last());
      const footer = await box(page.locator("footer"));
      expect(footer.y, `${width} px`).toBeGreaterThanOrEqual(last.y + last.height);
      expect(footer.y, `${width} px: below the first screen`).toBeGreaterThan(height);
      await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
      await expect(page.getByRole("contentinfo")).toBeInViewport({ ratio: 0.9 }); // reachable by scrolling
    }
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("AC-1: the gallery is in the page the server sends, with its texts", async ({ page }) => {
      await page.goto("/en");
      const t = messages("en").home.screenshots;
      await expect(page.getByRole("region", { name: t.heading }).getByRole("figure")).toHaveCount(3);
      await expect(page.getByText(t.mapCaption)).toBeVisible();
    });
  });

  test("AC-8: a signed-in visitor goes straight to the dashboard and never asks for a picture", async ({ page }) => {
    const asked: string[] = [];
    page.on("request", (request) => {
      if (/\/screenshots\/|\/_next\/image/.test(request.url())) asked.push(request.url());
    });
    await signInAsNewUser(page);
    await page.goto("/en");
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    await expect(page.getByRole("figure")).toHaveCount(0);
    expect(asked).toEqual([]);
  });
});
