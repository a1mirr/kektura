import { expect, test, type Browser, type Page } from "@playwright/test";
import { routing } from "../src/i18n/routing";
import { signInAsNewUser } from "./helpers";
import { psql } from "./local-db";

const userId = (email: string) => psql(`select id from auth.users where email = '${email}'`);

function stamp(id: string, keys: string[]) {
  const list = keys.map((k) => `'${k}'`).join(", ");
  psql(
    `insert into public.user_stamps (user_id, checkpoint_id, stamped_on) select '${id}', id, '2026-05-01' from public.checkpoints where coalesce(place_key, code) in (${list})`,
  );
}

async function connected(browser: Browser, { anaShares = true } = {}) {
  const anaPage = await (await browser.newContext()).newPage();
  const bobPage = await (await browser.newContext()).newPage();
  const anaId = userId(await signInAsNewUser(anaPage));
  const bobId = userId(await signInAsNewUser(bobPage));
  psql(`update public.profiles set display_name = 'Ana' where id = '${anaId}'`);
  psql(`update public.profiles set display_name = 'Bob' where id = '${bobId}'`);
  psql(
    `insert into public.friendships (user_id, friend_id, status, user_is_sharing, friend_is_sharing) values ('${bobId}', '${anaId}', 'accepted', true, ${anaShares})`,
  );
  stamp(anaId, ["OKTPH_01_DDKPH_01", "OKTPH_02", "OKTPH_03"]);
  stamp(bobId, ["OKTPH_02", "OKTPH_03", "OKTPH_04"]);
  return { anaPage, bobPage, anaId, bobId };
}

const overflow = (page: Page) =>
  page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const wide = [...document.body.querySelectorAll("*")]
      .filter((el) => el.getBoundingClientRect().right > width + 0.5)
      .map((el) => `<${el.tagName.toLowerCase()} class="${el.className}" ${el.getBoundingClientRect().width}/${el.scrollWidth}> ${(el.textContent ?? "").slice(0, 20)}`);
    return { px: document.documentElement.scrollWidth - width, wide };
  });
const card = (page: Page, who: string) => page.locator(`[data-who=${who}]`);

// Where a place is on the comparison map, in pixels from the map's top-left corner, without a test hook in the page:
// the map opens fitted to the trail's bounding box with 30 px of padding (createTrailMap), so the Web Mercator
// arithmetic of that fit gives the position of any point.
const mercatorX = (lng: number) => (lng + 180) / 360;
const mercatorY = (lat: number) => (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360;
function pixelOnFittedMap(
  size: { width: number; height: number },
  route: [number, number, number][],
  point: { lat: number; lng: number },
) {
  const lngs = route.map((p) => p[0]);
  const lats = route.map((p) => p[1]);
  const [west, east] = [Math.min(...lngs), Math.max(...lngs)];
  const [south, north] = [Math.min(...lats), Math.max(...lats)];
  const padding = 30;
  const scale = Math.min(
    (size.width - 2 * padding) / (mercatorX(east) - mercatorX(west)),
    (size.height - 2 * padding) / (mercatorY(south) - mercatorY(north)),
  );
  const centre = { x: (mercatorX(west) + mercatorX(east)) / 2, y: (mercatorY(south) + mercatorY(north)) / 2 };
  return {
    x: (mercatorX(point.lng) - centre.x) * scale + size.width / 2,
    y: (mercatorY(point.lat) - centre.y) * scale + size.height / 2,
  };
}

test.describe("spec 0024: comparing with a friend", () => {
  test("AC-22, AC-23: the figures of both, only me, only them and neither, from the places each stamped", async ({ browser }) => {
    const { bobPage, anaId } = await connected(browser);
    await bobPage.goto(`/en/friends/${anaId}`);
    const total = Number(psql("select round(max(km_from_start) - min(km_from_start), 1) from public.checkpoints"));
    const neither = (Math.round((total - 4.9 - 15.7 - 8.1) * 10) / 10).toLocaleString("en-US");

    await expect(bobPage.getByRole("region", { name: "Compare progress" })).toBeVisible();
    await expect(card(bobPage, "both")).toContainText("4.9 km");
    await expect(card(bobPage, "both")).toContainText("2 stamps");
    await expect(card(bobPage, "me")).toContainText("15.7 km");
    await expect(card(bobPage, "me")).toContainText("1 stamp");
    await expect(card(bobPage, "them")).toContainText("8.1 km");
    await expect(card(bobPage, "them")).toContainText("1 stamp");
    await expect(card(bobPage, "neither")).toContainText(`${neither} km`);
    await expect(card(bobPage, "neither")).toContainText("157 stamps");
    await expect(bobPage.getByLabel("Date of the stamp")).toHaveCount(0);
  });

  test("AC-22, AC-24: every stage says how it stands and links to its section below", async ({ browser }) => {
    const { bobPage, anaId } = await connected(browser);
    await bobPage.goto(`/en/friends/${anaId}`);
    const stages = bobPage.getByRole("region", { name: "Compare progress" }).getByRole("link", { name: /^Stage \d+/ });
    await expect(stages).toHaveCount(27);
    await expect(stages.nth(0)).toContainText("Me 3/9 · Them 3/9");
    await expect(stages.nth(0)).toContainText("Partly");
    await expect(stages.nth(1)).toContainText("Neither started");
    await stages.nth(0).click();
    await expect(bobPage).toHaveURL(/#stage-1$/);
    await expect(bobPage.locator("#stage-1")).toBeInViewport();
  });

  test("AC-22: a friend who is not sharing, a pending friend and an unknown id still end on 404", async ({ browser }) => {
    const { bobPage, anaId, bobId } = await connected(browser, { anaShares: false });
    expect((await bobPage.request.get(`/en/friends/${anaId}`)).status()).toBe(404);
    expect((await bobPage.request.get("/en/friends/00000000-0000-0000-0000-000000000000")).status()).toBe(404);
    psql(`update public.friendships set status = 'pending', friend_is_sharing = true where user_id = '${bobId}'`);
    expect((await bobPage.request.get(`/en/friends/${anaId}`)).status()).toBe(404);
  });

  test("AC-22: the comparison works at 375 px: cards in two columns, a full-width map, no sideways scroll", async ({ browser }) => {
    const { bobPage, anaId } = await connected(browser);
    for (const width of [375]) {
      await bobPage.setViewportSize({ width, height: 812 });
      for (const locale of [routing.defaultLocale, "de"]) {
        await bobPage.goto(`/${locale}/friends/${anaId}`);
        await expect(card(bobPage, "both")).toBeVisible();
        const boxes = await Promise.all(["both", "me", "them", "neither"].map((w) => card(bobPage, w).boundingBox()));
        expect(boxes[0]!.y, `${width} ${locale}: two columns`).toBe(boxes[1]!.y);
        expect(boxes[2]!.y, `${width} ${locale}: second row`).toBeGreaterThan(boxes[0]!.y);
        const map = (await bobPage.locator(".maplibregl-map").boundingBox())!;
        expect(map.width, `${width} ${locale}: map width`).toBeGreaterThan(width - 60);
        expect(map.height, `${width} ${locale}: map height`).toBeGreaterThanOrEqual(300);
        const sideways = await overflow(bobPage);
        expect(sideways.px, `${width} ${locale}: ${sideways.wide.join(" | ")}`).toBeLessThanOrEqual(0);
      }
    }
  });
});

test.describe("spec 0003: the comparison map", () => {
  test("AC-18, AC-19, AC-20: a map with a legend that follows the view: both, mine, theirs", async ({ browser }) => {
    const { bobPage, anaId } = await connected(browser);
    await bobPage.goto(`/en/friends/${anaId}`);
    const group = bobPage.getByRole("group", { name: "Map view" });
    await expect(group.getByRole("button", { name: "Both" })).toHaveAttribute("aria-pressed", "true");
    await expect(bobPage.locator("canvas.maplibregl-canvas")).toBeVisible(); // the map came up (WebGL pixels: manual row)
    const legend = bobPage.getByRole("list", { name: "Legend" });
    await expect(legend.getByRole("listitem")).toHaveText(["Both", "Only me", "Only them", "Neither"]);

    await group.getByRole("button", { name: "Mine" }).click();
    await expect(group.getByRole("button", { name: "Mine" })).toHaveAttribute("aria-pressed", "true");
    await expect(group.getByRole("button", { name: "Both" })).toHaveAttribute("aria-pressed", "false");
    await expect(legend.getByRole("listitem")).toHaveText(["Walked", "Not walked"]);

    await group.getByRole("button", { name: "Theirs" }).click();
    await expect(group.getByRole("button", { name: "Theirs" })).toHaveAttribute("aria-pressed", "true");
    await expect(legend.getByRole("listitem")).toHaveText(["Walked", "Not walked"]);
    await group.getByRole("button", { name: "Both" }).click();
    await expect(legend.getByRole("listitem")).toHaveCount(4);

    await bobPage.locator("canvas.maplibregl-canvas").click();
    await expect(bobPage.locator(".maplibregl-popup")).toHaveCount(0);
    await expect(bobPage.getByRole("button", { name: "Add stamp" })).toHaveCount(0);
  });

  test("AC-20: clicking a place brings its row in the list into view, opening its stage, and opens no popup", async ({ browser }) => {
    const { bobPage, anaId } = await connected(browser);
    await bobPage.goto(`/en/friends/${anaId}`);
    const route = (await (await bobPage.request.get("/data/okt-route.json")).json()) as { points: [number, number, number][] };
    // Irott-ko, the trail's westernmost place. Its neighbours lie a few pixels away on an overview map, so the click may
    // land on one of them: any row of stage 1 proves the click reached the list.
    const [lat, lng] = psql("select lat, lng from public.checkpoints where coalesce(place_key, code) = 'OKTPH_01_DDKPH_01' limit 1")
      .split("|")
      .map(Number);

    const map = bobPage.locator(".maplibregl-map");
    await map.scrollIntoViewIfNeeded();
    const stage = bobPage.locator("#stage-1 button[aria-expanded]");
    await expect(stage).toHaveAttribute("aria-expanded", "false");
    // Retried: the points are drawn a moment after the map loads, and a click before that finds nothing.
    await expect(async () => {
      const box = (await map.boundingBox())!;
      const at = pixelOnFittedMap(box, route.points, { lat, lng });
      await bobPage.mouse.click(box.x + at.x, box.y + at.y);
      await expect(stage).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
    }).toPass();
    await expect(bobPage.locator("#stage-1 li.flash")).toHaveCount(1);
    await expect(bobPage.locator(".maplibregl-popup")).toHaveCount(0);
  });
});
