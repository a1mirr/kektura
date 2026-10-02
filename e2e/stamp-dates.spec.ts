import { expect, test, type Locator, type Page } from "@playwright/test";
import { expandAllStages, signInAsNewUser, stat } from "./helpers";
import { psql } from "./local-db";

const place = (page: Page, key: string) => page.locator(`#place-${key}`);
const dateField = (row: Locator) => row.getByLabel("Date of the stamp");

// Local calendar day of the test browser (same machine and time zone as this process).
const today = (timeZone?: string) =>
  new Date().toLocaleDateString("en-CA", timeZone ? { timeZone } : undefined); // en-CA prints YYYY-MM-DD

// Counts the server actions the page sends from now on (every Server Action is a POST with Next-Action).
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
  test("AC-1, AC-5: a new stamp shows today's date in a labelled field with a valid range", async ({ page }) => {
    const email = await signInAsNewUser(page);
    await stampFirstPlaces(page);
    const field = dateField(place(page, "OKTPH_02"));
    await expect(field).toHaveValue(today());
    await expect(field).toHaveAttribute("min", "1938-01-01");
    await expect(field).toHaveAttribute("max", /^\d{4}-\d{2}-\d{2}$/);
    expect(storedDate(email, "OKTPH_02")).toBe(today());
    // The place that isn't stamped has no field.
    await expect(dateField(place(page, "OKTPH_03"))).toHaveCount(0);
  });

  test("AC-6: typing a whole date key by key makes one request, and the date is saved", async ({ page }) => {
    const email = await signInAsNewUser(page);
    await stampFirstPlaces(page);
    const field = dateField(place(page, "OKTPH_02"));
    const actions = countServerActions(page);

    // Chrome (en-US) reports a valid date for every digit of the year: 0002, 0020, 0202, 2026.
    await field.focus();
    await page.keyboard.type("09152025", { delay: 30 });
    await expect(field).toHaveValue("2025-09-15");
    await expect.poll(() => storedDate(email, "OKTPH_02")).toBe("2025-09-15");
    await page.waitForTimeout(1500); // nothing else is sent afterwards
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
    await page.waitForTimeout(1200);
    expect(actions.count).toBe(1); // none of those was sent
    expect(storedDate(email, "OKTPH_02")).toBe("2025-06-01");
  });

  test("AC-4: stamping again doesn't change the date of a stamp that already exists", async ({ page }) => {
    const email = await signInAsNewUser(page);
    await stampFirstPlaces(page);
    const field = dateField(place(page, "OKTPH_02"));
    await field.fill("2025-06-01");
    await field.blur();
    await expect.poll(() => storedDate(email, "OKTPH_02")).toBe("2025-06-01");

    // "Stamp stage" re-stamps every place of stage 1, including the one that already has a date.
    await page.locator("#stage-1").getByRole("button", { name: "Stamp stage" }).click();
    await expect(stat(page, "Stamps")).toHaveText("9 / 161");
    expect(storedDate(email, "OKTPH_02")).toBe("2025-06-01");
    expect(storedDate(email, "OKTPH_03")).toBe(today()); // the new ones get today
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
