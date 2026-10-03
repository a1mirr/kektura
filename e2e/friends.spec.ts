import { expect, test, type Browser, type Page } from "@playwright/test";
import { expandAllStages, measureDescriptions, signInAsNewUser, stat } from "./helpers";
import { psql } from "./local-db";

// Two people with their own browser contexts. Ana stamps two neighbouring places (8.1 km) and sets her name;
// Bob signs in through her invite link and asks to connect. Nothing is approved yet.
async function requestedFriendship(browser: Browser) {
  const anaPage = await (await browser.newContext()).newPage();
  const anaEmail = await signInAsNewUser(anaPage);
  await expandAllStages(anaPage);
  await anaPage.locator("#place-OKTPH_01_DDKPH_01").getByRole("button", { name: "Add stamp" }).click();
  await expect(stat(anaPage, "Stamps")).toHaveText("1 / 161");
  await anaPage.locator("#place-OKTPH_02").getByRole("button", { name: "Add stamp" }).click();
  await expect(stat(anaPage, "Kilometres")).toHaveText("8.1");

  await anaPage.goto("/en/friends");
  await anaPage.getByLabel("Your name (shown to friends)").fill("Ana");
  await anaPage.getByRole("button", { name: "Save" }).click();
  await expect(async () => {
    await anaPage.reload();
    await expect(anaPage.getByLabel("Your name (shown to friends)")).toHaveValue("Ana", { timeout: 1_000 });
  }).toPass();
  const inviteUrl = await inviteLink(anaPage);

  // AC-3: signed out, the link sends the visitor through sign-in and back to it.
  const bobPage = await (await browser.newContext()).newPage();
  await bobPage.goto(inviteUrl);
  await expect(bobPage.getByText("Sign in to continue")).toBeVisible();
  await expect(bobPage.getByText("Ana", { exact: true })).toHaveCount(0); // nothing about the owner before sign-in
  const bobEmail = `e2e-bob-${Date.now()}-${Math.random().toString(16).slice(2)}@kektura.test`;
  await bobPage.getByLabel(/^Test login/).fill(bobEmail);
  await bobPage.getByRole("button", { name: "Sign in as test user" }).click();
  await expect(bobPage).toHaveURL(inviteUrl);
  await expect(bobPage.getByRole("heading", { name: "Invite from Ana" })).toBeVisible();

  await bobPage.getByRole("button", { name: "Send request" }).click();
  await expect(bobPage).toHaveURL(/\/en\/friends\?sent=1$/);
  await expect(bobPage.getByText("Request sent.")).toBeVisible(); // AC-3: the requester is told
  const userId = (email: string) => psql(`select id from auth.users where email = '${email}'`);
  return { anaPage, bobPage, anaId: userId(anaEmail), bobId: userId(bobEmail), inviteUrl };
}

const inviteLink = (page: Page) => page.locator("input[readonly]").inputValue();

async function approve(anaPage: Page) {
  await anaPage.goto("/en/friends");
  await anaPage.getByRole("button", { name: "Approve" }).click();
  await expect(anaPage.getByRole("button", { name: "Approve" })).toHaveCount(0);
}

test.describe("spec 0024: friends", () => {
  test("AC-4, AC-5, AC-7, AC-8, AC-9, AC-10: request, approval, what a friend sees, the switch and removal", async ({ browser }) => {
    const { anaPage, bobPage, anaId } = await requestedFriendship(browser);

    // AC-4: the request is only visible to the inviter, and shares nothing yet.
    await expect(bobPage.getByText("You haven't added any friends yet.")).toBeVisible();
    expect((await bobPage.request.get(`/en/friends/${anaId}`)).status()).toBe(404); // not a friend yet
    await anaPage.goto("/en/friends");
    await expect(anaPage.getByRole("heading", { name: "Pending requests" })).toBeVisible();

    // AC-5, AC-7: after approval both see each other, with the numbers of Ana's dashboard.
    await approve(anaPage);
    await bobPage.goto("/en/friends");
    const row = bobPage.getByRole("listitem").filter({ hasText: "Ana" });
    await expect(row).toContainText("2 of 161 stamps · 8.1 km · stages completed: 0");
    await expect(row.getByText("Sharing progress")).toBeVisible();
    await anaPage.reload();
    await expect(anaPage.getByRole("listitem").filter({ hasText: "0 of 161 stamps" })).toBeVisible();

    await row.getByRole("link", { name: "Ana" }).click();
    await expect(bobPage.getByRole("heading", { name: "Ana" })).toBeVisible();
    await expect(stat(bobPage, "Stamps")).toHaveText("2 / 161");
    await expect(stat(bobPage, "Kilometres")).toHaveText("8.1");
    await expect(bobPage.getByLabel("Date of the stamp")).toHaveCount(0); // no stamp dates
    const friendPage = bobPage.url();

    // AC-9: Ana stops sharing; Bob sees "not sharing" and cannot open her page. The switch is hers alone.
    await anaPage.getByRole("button", { name: "Stop sharing" }).click();
    await expect(anaPage.getByRole("button", { name: "Start sharing" })).toBeVisible();
    await bobPage.goto("/en/friends");
    await expect(bobPage.getByRole("listitem").filter({ hasText: "Ana" })).toContainText("Not sharing with you");
    await expect(bobPage.getByRole("link", { name: "Ana" })).toHaveCount(0);
    expect((await bobPage.request.get(friendPage)).status()).toBe(404);
    await anaPage.getByRole("button", { name: "Start sharing" }).click();
    await expect(anaPage.getByRole("button", { name: "Stop sharing" })).toBeVisible();

    // AC-10: Bob removes Ana; both lists are empty, and Ana's page is closed to him.
    await bobPage.goto("/en/friends");
    await bobPage.getByRole("button", { name: "Remove" }).click();
    await expect(bobPage.getByText("You haven't added any friends yet.")).toBeVisible();
    await anaPage.reload();
    await expect(anaPage.getByText("You haven't added any friends yet.")).toBeVisible();
    expect((await bobPage.request.get(friendPage)).status()).toBe(404);
  });

  test("AC-2: regenerating the link invalidates the old one", async ({ browser }) => {
    const { anaPage, bobPage, inviteUrl } = await requestedFriendship(browser);
    await anaPage.getByRole("button", { name: "Regenerate" }).click();
    await expect(async () => {
      await anaPage.reload();
      expect(await inviteLink(anaPage)).not.toBe(inviteUrl);
    }).toPass();
    expect(await inviteLink(anaPage)).toMatch(/\/en\/friends\/invite\/[0-9a-f]{32}$/);

    await bobPage.goto(inviteUrl);
    await expect(bobPage.getByText("This link is not valid")).toBeVisible();
  });

  test("AC-11: deleting an account removes it from its friends' lists", async ({ browser }) => {
    const { anaPage, bobPage, bobId } = await requestedFriendship(browser);
    await approve(anaPage);
    await expect(anaPage.getByRole("listitem").filter({ hasText: "of 161 stamps" })).toBeVisible();

    await bobPage.goto("/en/account");
    await expect(async () => {
      await bobPage.getByRole("button", { name: "Delete account" }).click();
      await expect(bobPage.getByText("Are you sure? This cannot be undone.")).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await bobPage.getByRole("button", { name: "Yes, permanently delete my account" }).click();
    await expect(bobPage).toHaveURL(/\/en$/);

    expect(psql(`select count(*) from public.friendships where user_id = '${bobId}' or friend_id = '${bobId}'`)).toBe("0");
    expect(psql(`select count(*) from public.profiles where id = '${bobId}'`)).toBe("0");
    await anaPage.reload();
    await expect(anaPage.getByText("You haven't added any friends yet.")).toBeVisible();
  });

  test("AC-3: an unknown link and your own link are told apart", async ({ page }) => {
    await signInAsNewUser(page);
    await page.goto("/en/friends/invite/00000000000000000000000000000000");
    await expect(page.getByText("This link is not valid")).toBeVisible();

    await page.goto("/en/friends");
    await page.goto(await inviteLink(page));
    await expect(page.getByText("This is your own invite link")).toBeVisible();
  });

  test("AC-3: a request for someone you already asked says so", async ({ browser }) => {
    const { bobPage, inviteUrl } = await requestedFriendship(browser);
    await bobPage.goto(inviteUrl);
    await bobPage.getByRole("button", { name: "Send request" }).click();
    await expect(bobPage.getByText("You already sent a request.")).toBeVisible();
  });

  test("AC-7: signed-out visitors of /friends go to the landing page; unknown error codes are not shown", async ({ page, browser }) => {
    await page.goto("/en/friends");
    await expect(page).toHaveURL(/\/en$/);

    const other = await (await browser.newContext()).newPage();
    await signInAsNewUser(other);
    await other.goto("/en/friends?error=Your%20account%20is%20suspended");
    await expect(other.getByText("suspended")).toHaveCount(0);
    await other.goto("/en/friends?error=already_friends");
    await expect(other.getByText("You are already friends.")).toBeVisible();
  });

  test("AC-7: the friends pages fit a phone screen, also with the longest names", async ({ browser }) => {
    const { anaPage, bobPage, anaId, bobId, inviteUrl } = await requestedFriendship(browser);
    const overflow = (page: Page) =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    psql(`update public.profiles set display_name = repeat('W', 40) where id in ('${anaId}', '${bobId}')`);
    await anaPage.setViewportSize({ width: 375, height: 812 });

    for (const locale of ["hu", "ru"]) {
      await anaPage.goto(`/${locale}/friends`); // the longest words; Bob's request is pending
      await expect(anaPage.getByRole("button", { name: locale === "hu" ? "Elfogadás" : "Одобрить" })).toBeVisible();
      expect(await overflow(anaPage), `${locale} pending`).toBeLessThanOrEqual(0);
    }
    await anaPage.goto("/en/friends");
    await anaPage.getByRole("button", { name: "Approve" }).click();
    await expect(anaPage.getByRole("button", { name: "Approve" })).toHaveCount(0);
    for (const locale of ["hu", "ru"]) {
      await anaPage.goto(`/${locale}/friends`);
      expect(await overflow(anaPage), `${locale} friend`).toBeLessThanOrEqual(0);
    }
    // A friend's page and the invite page show the (long) name in their headings.
    await anaPage.goto(`/en/friends/${bobId}`);
    await expect(anaPage.getByRole("heading", { name: "W".repeat(40) })).toBeVisible();
    // The stage list is the dashboard's, and Ana left every stage open there: close them to measure the heading.
    await expect(async () => {
      await anaPage.getByRole("button", { name: "Collapse all" }).click();
      await expect(anaPage.locator("#stage-1 [aria-expanded]")).toHaveAttribute("aria-expanded", "false", { timeout: 1_000 });
    }).toPass();
    expect(await overflow(anaPage), "friend page").toBeLessThanOrEqual(0);
    await bobPage.setViewportSize({ width: 375, height: 812 });
    await bobPage.goto(inviteUrl.replace("/en/", "/ru/"));
    await expect(bobPage.getByRole("heading", { name: new RegExp("W{40}") })).toBeVisible();
    expect(await overflow(bobPage), "invite page").toBeLessThanOrEqual(0);
  });

  test("0001 AC-10 + 0033 AC-1: a friend's page shows the stamp descriptions in full at 375 px, in the page's language", async ({ browser }) => {
    const { anaPage, bobId } = await requestedFriendship(browser);
    await approve(anaPage);
    await anaPage.setViewportSize({ width: 375, height: 812 });
    await anaPage.goto(`/en/friends/${bobId}`);
    await expandAllStages(anaPage);
    const { measured, clipped } = await measureDescriptions(anaPage);
    expect(measured).toBeGreaterThan(200); // every stamp of the 161 places, stamped or not
    expect(clipped).toEqual([]);

    await anaPage.goto(`/ru/friends/${bobId}`);
    await expect(anaPage.locator("#place-OKTPH_66")).toContainText("На пересечении улиц Wesselényi");
  });

  test("AC-14: an action that fails says so on the page instead of doing nothing", async ({ page }) => {
    await signInAsNewUser(page);
    await page.goto("/en/friends");
    await page.getByLabel("Your name (shown to friends)").fill("   ");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Something went wrong, please try again.")).toBeVisible();

    // The message goes away with the next action that works.
    await page.getByLabel("Your name (shown to friends)").fill("Anna");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Something went wrong, please try again.")).toHaveCount(0);
    await expect(page).toHaveURL(/\/en\/friends$/);
  });

  test("AC-3: someone who already asked you is told to approve instead", async ({ browser }) => {
    const { anaPage, bobPage } = await requestedFriendship(browser);
    await bobPage.goto("/en/friends");
    const bobLink = await inviteLink(bobPage);
    await anaPage.goto(bobLink);
    await anaPage.getByRole("button", { name: "Send request" }).click();
    await expect(anaPage.getByText("This person already asked to connect with you")).toBeVisible();
  });

  test("AC-16: the dashboard links to the page and the About page tells what friends see (flag on)", async ({ page }) => {
    await signInAsNewUser(page);
    await page.getByRole("link", { name: "Friends" }).click();
    await expect(page).toHaveURL(/\/en\/friends$/);
    await page.goto("/en/about");
    await expect(page.getByText("They cannot see your stamp dates or extra stamps.")).toBeVisible();
  });
});
