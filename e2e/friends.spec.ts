import { expect, test, type Browser, type Page } from "@playwright/test";
import { expandAllStages, signInAsNewUser, stat } from "./helpers";
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
  await expect(bobPage).toHaveURL(/\/en\/friends$/);
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
    await bobPage.goto(`/en/friends/${anaId}`);
    await expect(bobPage.getByRole("heading", { name: "Ana" })).toHaveCount(0); // 404: not a friend yet
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
    await expect(bobPage.locator("input[type=date]")).toHaveCount(0); // no stamp dates
    const friendPage = bobPage.url();

    // AC-9: Ana stops sharing; Bob sees "not sharing" and cannot open her page. The switch is hers alone.
    await anaPage.getByRole("button", { name: "Stop sharing" }).click();
    await expect(anaPage.getByRole("button", { name: "Start sharing" })).toBeVisible();
    await bobPage.goto("/en/friends");
    await expect(bobPage.getByRole("listitem").filter({ hasText: "Ana" })).toContainText("Not sharing progress");
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

  test("AC-16: the dashboard links to the page and the About page tells what friends see (flag on)", async ({ page }) => {
    await signInAsNewUser(page);
    await page.getByRole("link", { name: "Friends" }).click();
    await expect(page).toHaveURL(/\/en\/friends$/);
    await page.goto("/en/about");
    await expect(page.getByText("They cannot see your stamp dates or extra stamps.")).toBeVisible();
  });
});
