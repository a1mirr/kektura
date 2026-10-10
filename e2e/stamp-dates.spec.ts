import { expect, test, type Locator, type Page } from "@playwright/test";
import { expandAllStages, signInAsNewUser, stat } from "./helpers";
import { psql } from "./local-db";

const place = (page: Page, key: string) => page.locator(`#place-${key}`);
const dateField = (row: Locator) => row.getByLabel("Date of the stamp");

const today = (timeZone?: string) =>
  new Date().toLocaleDateString("en-CA", timeZone ? { timeZone } : undefined);

function countServerActions(page: Page) {
  const state = { count: 0 };
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) state.count++;
  });
  return state;
}

const storedDate = (email: string, placeKey: string) =>
  psql(
    `select string_agg(distinct s.stamped_on::text, ',') from public.user_stamps s
       join auth.users u on u.id = s.user_id
       join public.checkpoints c on c.id = s.checkpoint_id
      where u.email = '${email}' and c.place_key = '${placeKey}'`,
  );

async function stampFirstPlaces(page: Page) {
  await expandAllStages(page);
  await place(page, "OKTPH_02").getByRole("button", { name: "Add stamp" }).click();
  await expect(stat(page, "Stamps")).toHaveText("1 / 161");
}

test.describe("spec 0016: stamp dates", () => {
  test("AC-1, AC-5, AC-9: a new stamp shows today's date as yyyy-mm-dd in a labelled field; the calendar has a valid range", async ({ page }) => {
    const email = await signInAsNewUser(page);
    await stampFirstPlaces(page);
    const field = dateField(place(page, "OKTPH_02"));
    await expect(field).toHaveValue(today());
    await expect(field).toHaveAttribute("type", "text");
    await expect(field).toHaveAttribute("placeholder", "yyyy-mm-dd");
    const picker = place(page, "OKTPH_02").locator("input[type=date]");
    await expect(picker).toHaveAttribute("min", "1938-01-01");
    const tomorrowUtc = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await expect(picker).toHaveAttribute("max", tomorrowUtc);
    await expect(place(page, "OKTPH_02").getByRole("button", { name: "Open calendar" })).toBeVisible();
    expect(storedDate(email, "OKTPH_02")).toBe(today());
    await expect(dateField(place(page, "OKTPH_03"))).toHaveCount(0);
  });

  test("AC-6: typing a whole date key by key makes one request, and the date is saved", async ({ page }) => {
    const email = await signInAsNewUser(page);
    await stampFirstPlaces(page);
    const field = dateField(place(page, "OKTPH_02"));
    const actions = countServerActions(page);

    await field.focus();
    await field.press("ControlOrMeta+a");
    await page.keyboard.type("2025-09-15", { delay: 30 });
    await expect(field).toHaveValue("2025-09-15");
    await expect.poll(() => storedDate(email, "OKTPH_02")).toBe("2025-09-15");
    await page.waitForTimeout(1500);
    expect(actions.count).toBe(1);

    await page.reload();
    await expandAllStages(page);
    await expect(dateField(place(page, "OKTPH_02"))).toHaveValue("2025-09-15");
  });

  test("AC-6: leaving the field saves at once; a future date is refused and the saved date comes back", async ({ page }) => {
    const email = await signInAsNewUser(page);
    await stampFirstPlaces(page);
    const field = dateField(place(page, "OKTPH_02"));
    const actions = countServerActions(page);

    await field.fill("2025-06-01");
    await field.blur();
    await expect.poll(() => storedDate(email, "OKTPH_02")).toBe("2025-06-01");
    expect(actions.count).toBe(1);

    await field.fill("2999-01-01");
    await field.blur();
    await expect(field).toHaveValue("2025-06-01");
    await field.fill("");
    await field.blur();
    await expect(field).toHaveValue("2025-06-01");
    for (const other of ["15/09/2025", "2025-9-5", "09/15/2025"]) {
      await field.fill(other);
      await field.blur();
      await expect(field).toHaveValue("2025-06-01");
    }
    await page.waitForTimeout(1200);
    expect(actions.count).toBe(1);
    expect(storedDate(email, "OKTPH_02")).toBe("2025-06-01");
  });

  test("AC-9: a day picked in the calendar fills the field and is saved at once", async ({ page }) => {
    const email = await signInAsNewUser(page);
    await stampFirstPlaces(page);
    const row = place(page, "OKTPH_02");
    await row.locator("input[type=date]").fill("2025-05-05");
    await expect(dateField(row)).toHaveValue("2025-05-05");
    await expect.poll(() => storedDate(email, "OKTPH_02")).toBe("2025-05-05");
    await page.reload();
    await expandAllStages(page);
    await expect(dateField(place(page, "OKTPH_02"))).toHaveValue("2025-05-05");
  });

  test("AC-4: stamping again doesn't change the date of a stamp that already exists", async ({ page }) => {
    const email = await signInAsNewUser(page);
    await stampFirstPlaces(page);
    const field = dateField(place(page, "OKTPH_02"));
    await field.fill("2025-06-01");
    await field.blur();
    await expect.poll(() => storedDate(email, "OKTPH_02")).toBe("2025-06-01");

    await page.locator("#stage-1").getByRole("button", { name: "Stamp stage" }).click();
    await expect(stat(page, "Stamps")).toHaveText("9 / 161");
    expect(storedDate(email, "OKTPH_02")).toBe("2025-06-01");
    expect(storedDate(email, "OKTPH_03")).toBe(today());
  });

  test("AC-4, AC-6: extra stamps have the same field and keep an edited date", async ({ page }) => {
    const email = await signInAsNewUser(page);
    await expandAllStages(page);
    const extraId = psql("select min(id) from public.extra_stamps");
    const row = page.locator(`#extra-${extraId}`);
    await row.getByRole("button", { name: "Add stamp" }).click();
    const field = dateField(row);
    await expect(field).toHaveValue(today());

    await field.fill("2024-08-20");
    await field.blur();
    const stored = () =>
      psql(`select s.stamped_on from public.user_extra_stamps s join auth.users u on u.id = s.user_id where u.email = '${email}'`);
    await expect.poll(stored).toBe("2024-08-20");
    await page.reload();
    await expandAllStages(page);
    await expect(dateField(page.locator(`#extra-${extraId}`))).toHaveValue("2024-08-20");
  });
});

// Kiritimati is UTC+14: for most of the day its calendar day isn't the server's (UTC) day.
test.describe("spec 0016 AC-1: the user's own day", () => {
  test.use({ timezoneId: "Pacific/Kiritimati" });

  test("a new stamp gets the day of the user's own time zone, not the server's", async ({ page }) => {
    const email = await signInAsNewUser(page);
    await stampFirstPlaces(page);
    const own = today("Pacific/Kiritimati");
    await expect(dateField(place(page, "OKTPH_02"))).toHaveValue(own);
    expect(storedDate(email, "OKTPH_02")).toBe(own);
    test.info().annotations.push({ type: "note", description: `own day ${own}, UTC day ${today("UTC")}` });
  });
});

const RETIRED = "OKT_RETIRED_NYIRJESI";
const bar = (page: Page) => page.getByRole("region", { name: "Set the date of several stamps" });
const checkbox = (page: Page, key: string) => place(page, key).getByRole("checkbox");
const bulkField = (page: Page) => bar(page).getByLabel("New date of the selected stamps");
const setDates = (page: Page) => page.getByRole("button", { name: "Set dates" });

async function stampStageOneAndAnExtra(page: Page) {
  await expandAllStages(page);
  await page.locator("#stage-1").getByRole("button", { name: "Stamp stage" }).click();
  await expect(stat(page, "Stamps")).toHaveText("9 / 161");
  const extraId = psql("select min(id) from public.extra_stamps");
  await page.locator(`#extra-${extraId}`).getByRole("button", { name: "Add stamp" }).click();
  await expect(dateField(page.locator(`#extra-${extraId}`))).toHaveValue(today());
  return extraId;
}

async function enterSetDates(page: Page) {
  await setDates(page).click();
  await expect(bar(page)).toBeVisible();
}

const datesOf = (email: string) =>
  psql(
    `select coalesce(string_agg(d, ',' order by d), '') from (
       select distinct c.place_key || '=' || s.stamped_on as d from public.user_stamps s join auth.users u on u.id = s.user_id join public.checkpoints c on c.id = s.checkpoint_id where u.email = '${email}'
       union all
       select 'extra' || x.extra_id || '=' || x.stamped_on from public.user_extra_stamps x join auth.users u on u.id = x.user_id where u.email = '${email}') t`,
  )
    .split(",")
    .filter(Boolean);

test.describe("spec 0016: set many dates at once", () => {
  test("AC-14, AC-15, AC-16, AC-19: choose by click, by shift-click, by stage and with the keyboard; one Apply dates them all, and the chart follows", async ({ page }) => {
    const email = await signInAsNewUser(page);
    const extraId = await stampStageOneAndAnExtra(page);
    const actions = countServerActions(page);

    await expect(page.getByRole("checkbox", { name: /^Select / })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /stage:/i })).toHaveCount(0);
    await enterSetDates(page);
    await expect(setDates(page)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("checkbox", { name: /^Select / })).toHaveCount(161 + 72);
    await expect(checkbox(page, "OKTPH_10")).toHaveCount(1);
    await expect(bar(page).getByRole("status")).toHaveText("0 selected");
    await expect(page.getByRole("button", { name: "Apply" })).toBeDisabled();

    await checkbox(page, "OKTPH_03").click();
    await checkbox(page, "OKTPH_06").click({ modifiers: ["Shift"] });
    await expect(bar(page).getByRole("status")).toHaveText("4 selected");
    for (const key of ["OKTPH_03", "OKTPH_04", "OKTPH_05", "OKTPH_06"]) await expect(checkbox(page, key)).toBeChecked();
    await expect(checkbox(page, "OKTPH_02")).not.toBeChecked();
    await checkbox(page, "OKTPH_09").focus();
    await page.keyboard.press("Space");
    await expect(bar(page).getByRole("status")).toHaveText("5 selected");
    await page.locator("#stage-1").getByRole("button", { name: "Select stage: Stage 1" }).click();
    await expect(bar(page).getByRole("status")).toHaveText("9 selected");
    await bar(page).getByRole("button", { name: "Clear" }).click();
    await expect(bar(page).getByRole("status")).toHaveText("0 selected");
    await bar(page).getByRole("button", { name: "Select all" }).click();
    await expect(bar(page).getByRole("status")).toHaveText("233 selected · 223 not stamped yet");
    await bar(page).getByRole("button", { name: "Clear" }).click();
    await page.locator("#stage-1").getByRole("button", { name: "Select stage: Stage 1" }).click();
    await checkbox(page, "OKTPH_01_DDKPH_01").click();
    await expect(bar(page).getByRole("status")).toHaveText("8 selected");

    expect(actions.count).toBe(0);
    await bulkField(page).click();
    await page.keyboard.type("2024-03-05", { delay: 20 });
    await page.waitForTimeout(1200);
    expect(actions.count).toBe(0);
    await expect(page.getByRole("button", { name: "Apply" })).toBeEnabled();
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page.getByText("8 dates set")).toBeVisible();
    await expect(bar(page)).toHaveCount(0);
    await expect(setDates(page)).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("checkbox", { name: /^Select / })).toHaveCount(0);
    expect(actions.count).toBe(1);
    await expect(dateField(place(page, "OKTPH_02"))).toHaveValue("2024-03-05");
    await expect(dateField(place(page, "OKTPH_01_DDKPH_01"))).toHaveValue(today());
    await expect(dateField(page.locator(`#extra-${extraId}`))).toHaveValue(today());
    const dates = datesOf(email);
    expect(dates.filter((d) => d.endsWith("=2024-03-05"))).toHaveLength(8);
    expect(dates).toContain(`OKTPH_01_DDKPH_01=${today()}`);
    expect(dates).toContain(`extra${extraId}=${today()}`);

    await page.goto("/en/stats");
    await expect(page.getByRole("button", { name: /^March 2024: 8 stamps/ })).toBeVisible();
  });

  test("AC-14, AC-16, AC-17: rows that are not stamped yet get stamped with the date, next to stamped ones that are re-dated", async ({ page }) => {
    const email = await signInAsNewUser(page);
    await stampFirstPlaces(page);
    const extraId = psql("select min(id) from public.extra_stamps");
    await expect(dateField(place(page, "OKTPH_10"))).toHaveCount(0);

    await enterSetDates(page);
    await checkbox(page, "OKTPH_02").click();
    await checkbox(page, "OKTPH_10").click();
    await checkbox(page, "OKTPH_11").click();
    await page.locator(`#extra-${extraId}`).getByRole("checkbox").click();
    await expect(bar(page).getByRole("status")).toHaveText("4 selected · 3 not stamped yet");
    await bulkField(page).fill("2023-07-01");
    await bulkField(page).press("Enter");

    await expect(page.getByText("4 dates set")).toBeVisible();
    await expect(stat(page, "Stamps")).toHaveText("3 / 161");
    for (const key of ["OKTPH_02", "OKTPH_10", "OKTPH_11"]) await expect(dateField(place(page, key))).toHaveValue("2023-07-01");
    await expect(dateField(page.locator(`#extra-${extraId}`))).toHaveValue("2023-07-01");
    expect(datesOf(email).sort()).toEqual(["OKTPH_02=2023-07-01", "OKTPH_10=2023-07-01", "OKTPH_11=2023-07-01", `extra${extraId}=2023-07-01`].sort());
    expect(psql(`select count(*) from public.user_stamps s join auth.users u on u.id = s.user_id where u.email = '${email}'`)).toBe(
      psql("select count(*) from public.checkpoints where place_key in ('OKTPH_02', 'OKTPH_10', 'OKTPH_11')"),
    );
  });

  test("AC-15, AC-16: a stage's 'Select stage' takes its places stamped or not, and Enter in the date field applies", async ({ page }) => {
    const email = await signInAsNewUser(page);
    await stampFirstPlaces(page);
    await expect(page.locator("#stage-1").getByRole("button", { name: /Select stage|Set date/ })).toHaveCount(0);
    await enterSetDates(page);
    await page.locator("#stage-1").getByRole("button", { name: "Select stage: Stage 1" }).click();
    await expect(bar(page).getByRole("status")).toHaveText("9 selected · 8 not stamped yet");
    await bulkField(page).fill("2023-07-01");
    await bulkField(page).press("Enter");
    await expect(page.getByText("9 dates set")).toBeVisible();
    await expect(stat(page, "Stamps")).toHaveText("9 / 161");
    await expect.poll(() => datesOf(email).filter((d) => d.endsWith("=2023-07-01")).length).toBe(9);
  });

  test("AC-14, AC-16: Escape and Cancel leave the mode and forget the choice; Apply stays off for a date it cannot send", async ({ page }) => {
    const email = await signInAsNewUser(page);
    await stampStageOneAndAnExtra(page);
    await enterSetDates(page);
    await checkbox(page, "OKTPH_02").click();
    await page.keyboard.press("Escape");
    await expect(bar(page)).toHaveCount(0);
    await expect(setDates(page)).toBeFocused();
    await enterSetDates(page);
    await expect(bar(page).getByRole("status")).toHaveText("0 selected");
    await checkbox(page, "OKTPH_02").click();
    for (const bad of ["2024-3-5", "05/03/2024", "2024-02-30", "1937-12-31", "2999-01-01"]) {
      await bulkField(page).fill(bad);
      await expect(page.getByRole("button", { name: "Apply" }), bad).toBeDisabled();
    }
    await bar(page).getByRole("button", { name: "Cancel" }).click();
    await expect(bar(page)).toHaveCount(0);
    expect(datesOf(email).every((d) => d.endsWith(`=${today()}`))).toBe(true);
  });

  test("AC-17: a stamp removed in another tab after the page was drawn is stamped again with the date", async ({ page }) => {
    const email = await signInAsNewUser(page);
    await stampStageOneAndAnExtra(page);
    await enterSetDates(page);
    await checkbox(page, "OKTPH_02").click();
    await checkbox(page, "OKTPH_03").click();
    // OKTPH_03 is removed in "another tab" after the page was drawn
    psql(
      `delete from public.user_stamps s using auth.users u, public.checkpoints c where s.user_id = u.id and c.id = s.checkpoint_id and u.email = '${email}' and c.place_key = 'OKTPH_03'`,
    );
    await bulkField(page).fill("2024-03-05");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("2 dates set")).toBeVisible();
    expect(datesOf(email).filter((d) => d.endsWith("=2024-03-05")).sort()).toEqual(["OKTPH_02=2024-03-05", "OKTPH_03=2024-03-05"]);
  });

  test("AC-18: a retired stamp cannot get a date from its retirement day on; the bar names it, and an earlier day goes through", async ({ page }) => {
    const email = await signInAsNewUser(page);
    await expandAllStages(page);
    await place(page, "OKTPH_102").getByRole("button", { name: "Add stamp" }).click();
    await expect(stat(page, "Stamps")).toHaveText("1 / 161");
    psql(
      `insert into public.user_stamps (user_id, checkpoint_id, stamped_on) select u.id, c.id, '2014-06-01' from auth.users u, public.checkpoints c where u.email = '${email}' and c.place_key = '${RETIRED}'`,
    );
    await page.reload();
    await expandAllStages(page);
    await expect(place(page, RETIRED)).toBeVisible();
    await enterSetDates(page);
    await checkbox(page, "OKTPH_102").click();
    await checkbox(page, RETIRED).click();
    await bulkField(page).fill("2024-03-05");
    await expect(bar(page)).toContainText("cannot get a date on or after the day it retired: Nyírjesi-erdészház");
    await expect(page.getByRole("button", { name: "Apply" })).toBeDisabled();
    await bulkField(page).fill("2014-11-20");
    await expect(bar(page)).not.toContainText("cannot get a date");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("2 dates set")).toBeVisible();
    await expect.poll(() => datesOf(email).sort()).toEqual([`${RETIRED}=2014-11-20`, "OKTPH_102=2014-11-20"].sort());
  });

  test("AC-14: a retired stamp that is not collected has no checkbox: it is collected on its own", async ({ page }) => {
    await signInAsNewUser(page);
    await expandAllStages(page);
    await page.getByLabel("Show retired stamps").check();
    await expect(place(page, RETIRED)).toBeVisible();
    await enterSetDates(page);
    await expect(checkbox(page, RETIRED)).toHaveCount(0);
    await expect(checkbox(page, "OKTPH_102")).toHaveCount(1);
  });

  test("AC-14: the toolbar with the button stays at the top of the window while the list scrolls, down to the extra stamps, and holds the bar in the mode", async ({ page }) => {
    await signInAsNewUser(page);
    await expandAllStages(page);
    for (const target of ["#stage-12", "#extra-stamps"]) {
      await page.locator(target).scrollIntoViewIfNeeded();
      await page.evaluate((selector) => document.querySelector(selector)!.scrollIntoView({ block: "center" }), target);
      const box = (await setDates(page).boundingBox())!;
      expect(box.y, `the button is at the top of the window next to ${target}`).toBeGreaterThanOrEqual(0);
      expect(box.y, `the button is at the top of the window next to ${target}`).toBeLessThan(80);
    }
    await setDates(page).click();
    const toolbarBottom = (await setDates(page).boundingBox())!.y;
    const barBox = (await bar(page).boundingBox())!;
    expect(barBox.y).toBeGreaterThan(toolbarBottom);
    expect(barBox.y).toBeLessThan(200);
  });

  test("AC-14: without JavaScript the mode is not offered, and the single date fields stay", async ({ page, browser, baseURL }) => {
    await signInAsNewUser(page);
    await stampStageOneAndAnExtra(page);
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false, storageState: await page.context().storageState() });
    try {
      const plain = await context.newPage();
      await plain.goto("/en/dashboard");
      await expect(plain.getByRole("button", { name: "Expand all" })).toBeVisible();
      await expect(setDates(plain)).toHaveCount(0);
      await expect(plain.getByRole("button", { name: /Set date|Select stage/ })).toHaveCount(0);
      await expect(plain.getByRole("checkbox", { name: /^Select / })).toHaveCount(0);
      await expect(plain.getByLabel("Date of the stamp")).toHaveCount(10);
    } finally {
      await context.close();
    }
  });
});

// In two columns the map's block is a sticky stacking context (z-10) holding the fullscreen overlay, and the toolbar
// and the bar of the mode sit below it (they are one sticky box of the other column): neither may paint over a
// fullscreen map.
test.describe("spec 0016: the button, the bar and the fullscreen map", () => {
  test("AC-21: at 1280 px the fullscreen map is topmost over the toolbar and over the bar of the mode", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Element.prototype, "requestFullscreen", { value: undefined, configurable: true });
    });
    await signInAsNewUser(page);
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    await expandAllStages(page);
    const covered = (box: { x: number; y: number; width: number; height: number }) =>
      page.evaluate((b) => {
        const points = [
          [b.x + b.width / 2, b.y + b.height / 2],
          [b.x + 10, b.y + 10],
          [b.x + b.width - 10, b.y + b.height - 10],
        ];
        return points.map(([x, y]) => !!document.elementFromPoint(x, y)?.closest(".fixed.inset-0"));
      }, box);
    const button = (await setDates(page).boundingBox())!;
    expect(button.y).toBeGreaterThan(0);
    expect(button.y).toBeLessThan(720); // the button is in the window, so it could paint over the map

    await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
    await expect(page.getByRole("button", { name: "Exit fullscreen" })).toBeVisible();
    expect(await covered(button)).toEqual([true, true, true]);
    await page.getByRole("button", { name: "Exit fullscreen" }).click();

    await enterSetDates(page);
    const at = (await bar(page).boundingBox())!;
    expect(at.y).toBeGreaterThan(0);
    expect(at.y).toBeLessThan(720); // the bar is in the window, so it could paint over the map
    await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
    await expect(page.getByRole("button", { name: "Exit fullscreen" })).toBeVisible();
    expect(await covered(at)).toEqual([true, true, true]);
  });
});
