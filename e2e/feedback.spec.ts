import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { anonRest, psql } from "./local-db";
import { signInAsNewUser } from "./helpers";

// Types into the box once the page has hydrated (before that React would reset the value).
async function typeMessage(page: Page, text: string) {
  const box = page.getByLabel("Your message");
  await expect(async () => {
    await box.fill(text);
    await expect(page.getByText(`${[...text].length} / 2000`)).toBeVisible({ timeout: 1_000 });
  }).toPass();
}

const rowsFor = (marker: string) =>
  psql(`select coalesce(user_id::text, 'anonymous'), message from public.user_feedback where message like '%${marker}%'`);

test.describe("spec 0017: feedback form", () => {
  test("AC-1, AC-3, AC-8: a visitor finds the form in the footer, sends a message, and it is stored anonymously", async ({
    page,
  }) => {
    const marker = randomUUID();
    await page.goto("/en");
    await page.getByRole("contentinfo").getByRole("link", { name: "Feedback" }).click();
    await expect(page).toHaveURL(/\/en\/feedback$/);
    await expect(page).toHaveTitle("Feedback");
    await expect(page.getByRole("button", { name: "Submit feedback" })).toBeDisabled();

    await typeMessage(page, `The map is great ${marker}`);
    await page.getByRole("button", { name: "Submit feedback" }).click();
    await expect(page.getByText("Thanks for your feedback!")).toBeVisible();
    await expect(page.getByLabel("Your message")).toHaveValue("");
    await expect(page.getByText("0 / 2000")).toBeVisible();

    expect(rowsFor(marker)).toBe(`anonymous|The map is great ${marker}`);
  });

  test("AC-3: a signed-in user's message is stored with their own id", async ({ page }) => {
    const marker = randomUUID();
    const email = await signInAsNewUser(page);
    await page.goto("/en/feedback");
    await typeMessage(page, `Found a bug ${marker}`);
    await page.getByRole("button", { name: "Submit feedback" }).click();
    await expect(page.getByText("Thanks for your feedback!")).toBeVisible();

    const userId = psql(`select id from auth.users where email = '${email}'`);
    expect(rowsFor(marker)).toBe(`${userId}|Found a bug ${marker}`);
  });

  test("AC-11: opened for a stamp (?stamp=<code>) the form names it, and the stored message starts with its name from the seed", async ({ page }) => {
    const marker = randomUUID();
    const prefix = `Stamp: Lokó-pihenő (OKTPH_84_B)\n\n`;
    const words = `It is by the lookout now ${marker}`;
    const left = 2000 - [...prefix].length;
    await page.goto("/en/feedback?stamp=OKTPH_84_B");
    await expect(page.locator("[data-feedback-stamp]")).toHaveText("About the stamp Lokó-pihenő (OKTPH_84_B)");
    await expect(page.getByText(`0 / ${left}`)).toBeVisible(); // the line takes its share of the 2000 characters
    const box = page.getByLabel("Your message");
    await expect(async () => {
      await box.fill(words);
      await expect(page.getByText(`${[...words].length} / ${left}`)).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await page.getByRole("button", { name: "Submit feedback" }).click();
    await expect(page.getByText("Thanks for your feedback!")).toBeVisible();
    expect(psql(`select message from public.user_feedback where message like '%${marker}%'`)).toBe(prefix + words);
  });

  test("AC-11: only a code of a current stamp of the seed counts: free text, an unknown code and a retired stamp's code give the plain form", async ({ page }) => {
    for (const query of ["stamp=Please%20send%20money%20to%20me", "stamp=OKTPH_999", "stamp=OKT_RETIRED_NYIRJESI", "stamp=%3Cscript%3Ealert(1)%3C%2Fscript%3E", "stamp=OKTPH_84_B&stamp=OKTPH_02", "stamp="]) {
      await page.goto(`/en/feedback?${query}`);
      await expect(page.getByLabel("Your message"), query).toBeVisible();
      await expect(page.locator("[data-feedback-stamp]"), query).toHaveCount(0);
      await expect(page.getByText("0 / 2000"), query).toBeVisible();
    }
  });

  test("AC-8: Russian and Hungarian forms have their own labels", async ({ page }) => {
    await page.goto("/ru/feedback");
    await expect(page.getByLabel("Ваше сообщение")).toBeVisible();
    await page.goto("/hu/feedback");
    await expect(page.getByLabel("Üzeneted")).toBeVisible();
  });
});

// The rules live in the database (migration 0008), so they are checked there, as an anonymous caller.
test.describe("spec 0017 AC-2, AC-3 and spec 0014: database rules", () => {
  test("anonymous feedback is accepted", async ({ request }) => {
    const marker = randomUUID();
    const res = await anonRest(request, "user_feedback", { method: "POST", body: { message: `direct ${marker}` } });
    expect(res.status()).toBe(201);
    expect(rowsFor(marker)).toBe(`anonymous|direct ${marker}`);
  });

  test("feedback can't be filed in somebody else's name", async ({ request }) => {
    const someone = psql("select id from auth.users limit 1") || randomUUID();
    const res = await anonRest(request, "user_feedback", { method: "POST", body: { message: "forged", user_id: someone } });
    expect([401, 403]).toContain(res.status());
    expect(await res.json()).toMatchObject({ code: "42501" });
  });

  test("a message over 2000 characters or an empty one is refused", async ({ request }) => {
    const tooLong = await anonRest(request, "user_feedback", { method: "POST", body: { message: "x".repeat(2001) } });
    expect(tooLong.status()).toBe(400);
    expect(await tooLong.json()).toMatchObject({ code: "23514" });
    const empty = await anonRest(request, "user_feedback", { method: "POST", body: { message: "" } });
    expect(empty.status()).toBe(400);
  });

  test("nothing can read feedback through the API", async ({ request }) => {
    const res = await anonRest(request, "user_feedback?select=message");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test("an anonymous caller can't run delete_user_account", async ({ request }) => {
    const res = await anonRest(request, "rpc/delete_user_account", { method: "POST", body: {} });
    expect([401, 403]).toContain(res.status());
    expect(await res.json()).toMatchObject({ code: "42501" });
  });
});
