import { expect, test, type Browser, type Page } from "@playwright/test";
import { signInAsNewUser } from "./helpers";
import { psql } from "./local-db";

// Spec 0036 (the page layout), spec 0001 AC-28 (the dashboard's two columns), spec 0024 AC-27 and AC-28 (the friend's page and
// the Friends page) and spec 0003 AC-24, AC-25 (the map's height, a resized window). The widths are the ones the layout
// promises: 375 is the narrowest, 1024 is where the columns start.
const PAGE_WIDTH = 1024; // 64 rem, spec 0036 AC-1
const WIDTHS = [375, 768, 1024, 1440, 1920];

const box = async (locator: ReturnType<Page["locator"]>) => (await locator.boundingBox())!;

// The scrollbar takes part of the window: the layout works with the width that is left.
const clientWidth = (page: Page) => page.evaluate(() => document.documentElement.clientWidth);

// How far the page scrolls sideways (0: not at all), with the elements that stick out for the failure message.
async function expectNoSidewaysScroll(page: Page, message: string) {
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

// The logo's strip, the page and the footer: one width, one pair of edges (spec 0036 AC-1).
async function expectSharedEdges(page: Page, label: string, { footer: hasFooter = true } = {}) {
  const width = await clientWidth(page);
  const strip = await box(page.locator("body > header"));
  const main = await box(page.locator("main"));
  const footer = hasFooter ? await box(page.locator("footer nav")) : strip; // the 404 page has no footer
  const expected = Math.min(PAGE_WIDTH, width);
  for (const [name, b] of Object.entries({ strip, main, footer })) {
    expect(b.width, `${label}: ${name} width`).toBeCloseTo(expected, 0);
    expect(b.x, `${label}: ${name} left edge`).toBeCloseTo(strip.x, 0);
  }
  expect(main.x, `${label}: centred`).toBeCloseTo((width - expected) / 2, 0);
  // the mark itself starts at the content's edge: the padding is 16 px up to 640 px and 24 px above
  const mark = await box(page.locator("body > header img"));
  expect(mark.x, `${label}: the logo's mark at the content edge`).toBeCloseTo(main.x + (width >= 640 ? 24 : 16), 0);
}

const PUBLIC_PAGES = ["", "/about", "/changelog", "/links", "/feedback"];

test.describe("spec 0036: the page layout", () => {
  test("AC-1, AC-5: header strip, page and footer share one width and edges, and nothing scrolls sideways, on the public pages", async ({
    page,
  }) => {
    test.setTimeout(180_000); // a long sweep: every page at five widths
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of PUBLIC_PAGES) {
        await page.goto(`/en${path}`);
        await expectSharedEdges(page, `${width} px, /en${path}`);
        await expectNoSidewaysScroll(page, `sideways scroll at ${width} px on /en${path}`);
      }
    }
  });

  test("AC-1, AC-5: the same on the dashboard, account and Friends pages, where the page's own header lies inside the width", async ({ page }) => {
    test.setTimeout(180_000);
    await signInAsNewUser(page);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/dashboard", "/account", "/friends"]) {
        await page.goto(`/en${path}`);
        await expectSharedEdges(page, `${width} px, /en${path}`);
        await expectNoSidewaysScroll(page, `sideways scroll at ${width} px on /en${path}`);
      }
      await page.goto("/en/dashboard");
      const main = await box(page.locator("main"));
      const header = await box(page.locator("main > header"));
      expect(header.x).toBeGreaterThanOrEqual(main.x);
      expect(header.x + header.width).toBeLessThanOrEqual(main.x + main.width + 0.5);
      // the language switcher and the links end at the right edge of the content, not of the window
      const switcher = await box(page.getByLabel("Language"));
      const account = await box(page.getByRole("link", { name: "Account" }));
      expect(Math.max(switcher.x + switcher.width, account.x + account.width)).toBeLessThanOrEqual(main.x + main.width + 0.5);
    }
  });

  test("AC-5: in every other language too nothing scrolls sideways and the edges are shared", async ({ page }) => {
    test.setTimeout(180_000);
    await signInAsNewUser(page);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const locale of ["hu", "de", "ru"]) {
        for (const path of ["/dashboard", "/friends", "/account", "/about", "/changelog"]) {
          await page.goto(`/${locale}${path}`);
          await expectSharedEdges(page, `${width} px, /${locale}${path}`);
          await expectNoSidewaysScroll(page, `sideways scroll at ${width} px on /${locale}${path}`);
        }
      }
    }
  });

  test("AC-1, AC-5: the 404 page, the invite page (signed out and signed in) and a friend's page share the edges too and do not scroll sideways", async ({
    browser,
  }) => {
    const { bobPage, anaId } = await connected(browser);
    const signedOut = await (await browser.newContext()).newPage();
    for (const width of [375, 768, 1920]) {
      await signedOut.setViewportSize({ width, height: 900 });
      await signedOut.goto("/en/no-such-page");
      await expectSharedEdges(signedOut, `${width} px, the 404 page`, { footer: false });
      await expectNoSidewaysScroll(signedOut, `sideways scroll at ${width} px on the 404 page`);
      await signedOut.goto("/en/friends/invite/not-a-real-token");
      await expectSharedEdges(signedOut, `${width} px, the invite page, signed out`);
      await expectNoSidewaysScroll(signedOut, `sideways scroll at ${width} px on the invite page, signed out`);
      await bobPage.setViewportSize({ width, height: 900 });
      await bobPage.goto("/en/friends/invite/not-a-real-token");
      await expectSharedEdges(bobPage, `${width} px, the invite page, signed in`);
      await expectNoSidewaysScroll(bobPage, `sideways scroll at ${width} px on the invite page, signed in`);
      await bobPage.goto(`/en/friends/${anaId}`);
      await expectSharedEdges(bobPage, `${width} px, a friend's page`);
      await expectNoSidewaysScroll(bobPage, `sideways scroll at ${width} px on a friend's page`);
    }
  });

  test("AC-1: the logo is never at the window's edge on a wide window", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 900 });
    await page.goto("/en/about");
    const mark = await box(page.locator("body > header img"));
    expect(mark.x).toBeGreaterThan((1920 - PAGE_WIDTH) / 2);
  });

  test("AC-3: the long reads keep a text column of about 65 characters, centred in the content width", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const path of ["/about", "/changelog", "/links", "/feedback"]) {
      await page.goto(`/en${path}`);
      const column = page.locator("main > div").first();
      const main = await box(page.locator("main"));
      const col = await box(column);
      const sixtyFiveCh = await column.evaluate((el) => {
        const probe = document.createElement("div");
        probe.style.width = "65ch";
        el.appendChild(probe);
        const px = probe.getBoundingClientRect().width;
        probe.remove();
        return px;
      });
      expect(col.width, path).toBeCloseTo(sixtyFiveCh, 0);
      expect(col.x + col.width / 2, `${path}: centred`).toBeCloseTo(main.x + main.width / 2, 0);
      // the text of the page lies in the column
      const paragraph = await box(page.locator("main p").first());
      expect(paragraph.width, path).toBeLessThanOrEqual(col.width + 0.5);
    }
  });

  test("AC-3: the account page's text blocks keep that line length too, while its cards use the full width", async ({ page }) => {
    await signInAsNewUser(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en/account");
    const main = await box(page.locator("main"));
    const card = await box(page.locator("main section").first());
    expect(card.width).toBeGreaterThan(main.width - 60);
    const text = page.locator("main p").first();
    const sixtyFiveCh = await text.evaluate((el) => {
      const probe = document.createElement("div");
      probe.style.width = "65ch";
      el.parentElement!.appendChild(probe);
      const px = probe.getBoundingClientRect().width;
      probe.remove();
      return px;
    });
    expect((await box(text)).width).toBeLessThanOrEqual(sixtyFiveCh + 0.5);
  });

  test("AC-4: the landing page and the 404 page keep a centred block, not a wide column", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 900 });
    for (const path of ["/en", "/en/no-such-page"]) {
      await page.goto(path);
      const main = await box(page.locator("main"));
      const block = await box(page.locator("main > div, main > h1").first());
      expect(block.width, path).toBeLessThanOrEqual(672 + 0.5); // max-w-2xl
      expect(block.x + block.width / 2, `${path}: centred`).toBeCloseTo(main.x + main.width / 2, 0);
    }
  });

  test("AC-4: the invite page keeps its narrow card", async ({ page }) => {
    await signInAsNewUser(page);
    await page.setViewportSize({ width: 1920, height: 900 });
    await page.goto("/en/friends/invite/not-a-real-token");
    const main = await box(page.locator("main"));
    const card = await box(page.locator("main > div"));
    expect(card.width).toBeLessThanOrEqual(448 + 0.5); // max-w-md
    expect(card.x + card.width / 2).toBeCloseTo(main.x + main.width / 2, 0);
  });

  test("AC-6: the footer stays on the first screen of the landing page at every width", async ({ page }) => {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/en");
      const footer = await box(page.locator("footer"));
      expect(footer.y + footer.height, `${width} px`).toBeLessThanOrEqual(800 + 0.5);
    }
  });
});

test.describe("spec 0001: the dashboard's two columns", () => {
  test("AC-28: from 1024 px the figures and the map stand left of the stage list, and stay in view while it scrolls", async ({ page }) => {
    await signInAsNewUser(page);
    for (const width of [1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/en/dashboard");
      const aside = page.locator("[data-page-aside]");
      const stage = page.locator("#stage-1");
      await expect(page.locator(".maplibregl-canvas")).toBeVisible();
      const [a, s] = [await box(aside), await box(stage)];
      expect(a.x + a.width, `${width} px: the aside is left of the list`).toBeLessThanOrEqual(s.x);
      expect(s.y - a.y, `${width} px: the list starts beside the aside, under its own heading`).toBeLessThan(200);
      expect(s.y, `${width} px`).toBeGreaterThanOrEqual(a.y);
      // the figures are in the aside, in two columns, the map under them
      const cards = page.locator("[data-page-aside] dl > div");
      await expect(cards).toHaveCount(4);
      const [c1, c2, c3] = [await box(cards.nth(0)), await box(cards.nth(1)), await box(cards.nth(2))];
      expect(c1.y).toBeCloseTo(c2.y, 0);
      expect(c3.y).toBeGreaterThan(c1.y);
      // it stays in view: after scrolling a long way its top is 16 px below the window's
      await page.evaluate(() => window.scrollTo(0, 1500));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
      const stuck = await box(aside);
      expect(stuck.y, `${width} px: sticky`).toBeLessThan(40);
      expect(stuck.y + stuck.height, `${width} px: the whole aside fits the window`).toBeLessThanOrEqual(800 + 0.5);
      await expect(page.locator(".maplibregl-canvas")).toBeInViewport();
    }
  });

  test("AC-28: below 1024 px it is one column in the order cards, map, stage list, extra stamps", async ({ page }) => {
    await signInAsNewUser(page);
    for (const width of [375, 768, 1023]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/en/dashboard");
      const [cards, map, stage, extras] = await Promise.all([
        box(page.locator("dl").first()),
        box(page.locator("[data-page-aside] section")),
        box(page.locator("#stage-1")),
        box(page.locator("#extra-stamps")),
      ]);
      expect(map.y, `${width} px`).toBeGreaterThanOrEqual(cards.y + cards.height);
      expect(stage.y, `${width} px`).toBeGreaterThanOrEqual(map.y + map.height);
      expect(extras.y, `${width} px`).toBeGreaterThanOrEqual(stage.y + stage.height);
      expect(stage.width, `${width} px: the list uses the width`).toBeGreaterThan(width - 60);
      const aside = await page.locator("[data-page-aside]").evaluate((el) => getComputedStyle(el).position);
      expect(aside, `${width} px: nothing sticks`).toBe("static");
    }
  });

  test("AC-28: \"Show in list\" and the stage links still bring a row into view in the two columns", async ({ page }) => {
    await signInAsNewUser(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/en/dashboard");
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    await page.getByRole("link", { name: /^go to extra stamps/ }).first().click();
    await expect(page.locator("#extra-stamps li").first()).toBeInViewport();
    await page.locator("#stage-3 button[aria-expanded]").click();
    await page.locator("#stage-3 li").first().scrollIntoViewIfNeeded();
    await expect(page.locator("#stage-3 li").first()).toBeInViewport();
  });
});

test.describe("spec 0003: the map's size", () => {
  test("AC-24: the map is never taller than 70 % of the window, at any window height and width", async ({ page }) => {
    await signInAsNewUser(page);
    for (const [width, height] of [
      [1440, 900],
      [1280, 720],
      [1024, 600],
      [1920, 1080],
      [768, 500],
      [812, 375], // a phone on its side
      [375, 812],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto("/en/dashboard");
      await expect(page.locator(".maplibregl-canvas")).toBeVisible();
      const map = await box(page.locator(".map-box"));
      expect(map.height, `${width} x ${height}`).toBeLessThanOrEqual(height * 0.7 + 0.5);
      expect(map.height, `${width} x ${height}: still a map`).toBeGreaterThan(100);
    }
  });

  test("AC-24: from 1024 px the whole left column, map included, fits the window height, so the map's bottom is never cut off", async ({
    page,
  }) => {
    await signInAsNewUser(page);
    for (const [width, height] of [
      [1280, 720],
      [1440, 900],
      [1024, 768],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto("/en/dashboard");
      await expect(page.locator(".maplibregl-canvas")).toBeVisible();
      const aside = page.locator("[data-page-aside]");
      const { scroll, client } = await aside.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
      expect(scroll, `${width} x ${height}: nothing scrolls inside the column`).toBeLessThanOrEqual(client);
    }
  });

  test("AC-25: the map fits its box when the window is resized, and the canvas follows", async ({ page }) => {
    await signInAsNewUser(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en/dashboard");
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    for (const [width, height] of [
      [1100, 800],
      [800, 700],
      [400, 800],
      [1600, 900],
    ]) {
      await page.setViewportSize({ width, height });
      await expect
        .poll(
          async () => {
            const [container, canvas] = await Promise.all([box(page.locator(".maplibregl-map")), box(page.locator(".maplibregl-canvas"))]);
            return Math.abs(container.width - canvas.width) <= 1 && Math.abs(container.height - canvas.height) <= 1;
          },
          { message: `the canvas follows its box at ${width} x ${height}` },
        )
        .toBe(true);
      const container = await box(page.locator(".maplibregl-map"));
      const section = await box(page.locator("[data-page-aside] section"));
      expect(container.width, `${width} px: the map is as wide as its card`).toBeGreaterThan(section.width - 40);
      expect(container.x + container.width).toBeLessThanOrEqual(section.x + section.width);
    }
  });
});

// Two people with their own browser contexts, connected and sharing with each other through the database (the invite
// flow has its own tests in friends.spec.ts).
async function connected(browser: Browser) {
  const anaPage = await (await browser.newContext()).newPage();
  const bobPage = await (await browser.newContext()).newPage();
  const idOf = (email: string) => psql(`select id from auth.users where email = '${email}'`);
  const anaId = idOf(await signInAsNewUser(anaPage));
  const bobId = idOf(await signInAsNewUser(bobPage));
  psql(`update public.profiles set display_name = 'Ana' where id = '${anaId}'`);
  psql(`update public.profiles set display_name = 'Bob' where id = '${bobId}'`);
  psql(
    `insert into public.friendships (user_id, friend_id, status, user_is_sharing, friend_is_sharing) values ('${bobId}', '${anaId}', 'accepted', true, true)`,
  );
  return { anaPage, bobPage, anaId };
}

test.describe("spec 0024: the friends pages in two columns", () => {
  test("AC-27: from 1024 px a friend's page puts the Compare section next to the stage list, below it one column", async ({ browser }) => {
    const { bobPage, anaId } = await connected(browser);
    for (const [width, columns] of [
      [1023, false],
      [1024, true],
      [1440, true],
      [375, false],
    ] as const) {
      await bobPage.setViewportSize({ width, height: 900 });
      await bobPage.goto(`/en/friends/${anaId}`);
      const compare = await box(bobPage.getByRole("region", { name: "Compare progress" }));
      const list = await box(bobPage.locator("#stage-1"));
      if (columns) {
        expect(compare.x + compare.width, `${width} px: compare is left of the list`).toBeLessThanOrEqual(list.x);
        expect(Math.abs(compare.y - list.y), `${width} px: same top`).toBeLessThan(80);
      } else {
        expect(list.y, `${width} px: the list is below the comparison`).toBeGreaterThanOrEqual(compare.y + compare.height - 1);
      }
      // the friend's own figures stay above both, over the full width
      const figures = await box(bobPage.locator("main > dl"));
      expect(figures.y + figures.height).toBeLessThanOrEqual(Math.min(compare.y, list.y) + 1);
      await expectNoSidewaysScroll(bobPage, `a friend's page at ${width} px`);
    }
  });

  test("AC-28: from 1024 px the Friends page puts the person's own controls next to the list of friends, below it one column", async ({
    browser,
  }) => {
    const { bobPage } = await connected(browser);
    for (const [width, columns] of [
      [1023, false],
      [1024, true],
      [1440, true],
      [375, false],
    ] as const) {
      await bobPage.setViewportSize({ width, height: 900 });
      await bobPage.goto("/en/friends");
      const name = await box(bobPage.getByLabel(/^Your name/));
      const invite = await box(bobPage.getByLabel("Your invite link"));
      const friends = await box(bobPage.getByRole("heading", { name: "Your friends" }));
      if (columns) {
        expect(name.x + name.width, `${width} px: the name field is left of the list`).toBeLessThanOrEqual(friends.x);
        expect(invite.x + invite.width, `${width} px: the invite link is left of the list`).toBeLessThanOrEqual(friends.x);
      } else {
        expect(friends.y, `${width} px: the list comes below the controls`).toBeGreaterThan(invite.y + invite.height);
      }
      await expectNoSidewaysScroll(bobPage, `the Friends page at ${width} px`);
    }
  });
});
