import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
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
  await expect(bobPage).toHaveURL(/\/en\/friends\?ok=sent$/);
  await expect(status(bobPage)).toContainText("Request sent."); // AC-3: the requester is told
  const userId = (email: string) => psql(`select id from auth.users where email = '${email}'`);
  return { anaPage, bobPage, anaId: userId(anaEmail), bobId: userId(bobEmail), inviteUrl };
}

// The page's own answer (spec 0024 AC-18): the test server's banner is a `status` too, and Next's route
// announcer an (empty) `alert`.
const status = (page: Page) => page.locator("[role=status][aria-live=polite]");
const alert = (page: Page) => page.getByRole("alert").filter({ hasText: /\S/ });

const inviteLink = (page: Page) => page.locator("input[readonly]").inputValue();

// Spec 0024 AC-19: remove and regenerate ask first. The question is a <details>: its summary opens it, the
// confirming button inside is the real submit.
async function confirmed(scope: Locator, label: string, yes: string) {
  await scope.locator("summary", { hasText: label }).click();
  await scope.getByRole("button", { name: yes }).click();
}

async function approve(anaPage: Page) {
  await anaPage.goto("/en/friends");
  await anaPage.getByRole("button", { name: "Approve" }).click();
  await expect(anaPage.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(status(anaPage)).toHaveText("Friend request approved."); // AC-18
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
    await expect(status(anaPage)).toHaveText("Sharing stopped."); // AC-18
    await bobPage.goto("/en/friends");
    await expect(bobPage.getByRole("listitem").filter({ hasText: "Ana" })).toContainText("Not sharing with you");
    await expect(bobPage.getByRole("link", { name: "Ana" })).toHaveCount(0);
    expect((await bobPage.request.get(friendPage)).status()).toBe(404);
    await anaPage.getByRole("button", { name: "Start sharing" }).click();
    await expect(anaPage.getByRole("button", { name: "Stop sharing" })).toBeVisible();
    await expect(status(anaPage)).toHaveText("You are sharing your progress with this friend."); // AC-18

    // AC-10: Bob removes Ana; both lists are empty, and Ana's page is closed to him.
    await bobPage.goto("/en/friends");
    await confirmed(bobPage.getByRole("listitem").filter({ hasText: "Ana" }), "Remove", "Yes, remove");
    await expect(bobPage.getByText("You haven't added any friends yet.")).toBeVisible();
    await expect(status(bobPage)).toHaveText("Friend removed."); // AC-18
    await anaPage.reload();
    await expect(anaPage.getByText("You haven't added any friends yet.")).toBeVisible();
    expect((await bobPage.request.get(friendPage)).status()).toBe(404);
  });

  test("AC-2: regenerating the link invalidates the old one", async ({ browser }) => {
    const { anaPage, bobPage, inviteUrl } = await requestedFriendship(browser);
    await confirmed(anaPage.locator("section", { hasText: "Your invite link" }), "Regenerate", "Yes, create a new link");
    await expect(status(anaPage)).toContainText("The old one no longer works."); // AC-18
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
    await expect(alert(other)).toHaveText("You are already friends."); // AC-18: a failure is an alert
    await other.goto("/en/friends?ok=Everything%20is%20fine");
    await expect(status(other)).toHaveCount(0); // AC-18: an unknown ?ok= is not shown either
    await other.goto("/en/friends?sent=1");
    await expect(status(other)).toHaveCount(0); // the old way of saying "request sent" is gone
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
    await expect(page).toHaveURL(/\/en\/friends\?ok=name$/);
    await expect(status(page)).toHaveText("Name saved.");
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

test.describe("spec 0024: the Friends page buttons respond", () => {
  test("AC-17: a pressed button is disabled and busy until the server answers, and a second press sends nothing", async ({ page }) => {
    await signInAsNewUser(page);
    await page.goto("/en/friends");
    let posts = 0;
    await page.route("**/en/friends", async (route) => {
      if (route.request().method() === "POST") {
        posts++;
        await new Promise((resolve) => setTimeout(resolve, 1_500)); // a slow server
      }
      await route.continue();
    });
    await expect(async () => {
      await page.getByLabel("Your name (shown to friends)").fill("Anna");
      await page.getByRole("button", { name: "Save" }).click({ timeout: 1_000 });
      await expect(page.getByRole("button", { name: "Save" })).toBeDisabled({ timeout: 500 });
    }).toPass();
    const save = page.getByRole("button", { name: "Save" });
    await expect(save).toHaveAttribute("aria-busy", "true");
    await save.click({ force: true }); // a disabled button takes no press
    await expect(status(page)).toHaveText("Name saved.");
    await expect(save).toBeEnabled();
    expect(posts).toBe(1);
  });

  test("AC-18: the answer is said in the page's language", async ({ browser }) => {
    const { anaPage } = await requestedFriendship(browser);
    await anaPage.goto("/ru/friends");
    await anaPage.getByRole("button", { name: "Одобрить" }).click();
    await expect(status(anaPage)).toHaveText("Запрос в друзья одобрен.");
    await anaPage.goto("/hu/friends");
    await anaPage.getByLabel("A neved (a barátaid látják)").fill("Ana");
    await anaPage.getByRole("button", { name: "Mentés" }).click();
    await expect(status(anaPage)).toHaveText("Név mentve.");
  });

  test("AC-18: ignoring a request says so, and the next action clears the message", async ({ browser }) => {
    const { anaPage } = await requestedFriendship(browser);
    await anaPage.goto("/en/friends");
    await anaPage.getByRole("button", { name: "Ignore" }).click();
    await expect(status(anaPage)).toHaveText("Friend request ignored.");
    await anaPage.getByRole("button", { name: "Save" }).click();
    await expect(status(anaPage)).toHaveText("Name saved.");
  });

  test("AC-19: removing a friend and regenerating the link ask first, in the page", async ({ browser }) => {
    const { anaPage, bobPage } = await requestedFriendship(browser);
    await approve(anaPage);
    await bobPage.goto("/en/friends");
    const row = bobPage.getByRole("listitem").filter({ hasText: "Ana" });
    const details = row.locator("details");

    // The first press only asks: nothing is removed. Cancel and Escape close the question.
    await expect(async () => {
      await row.locator("summary", { hasText: "Remove" }).click();
      await expect(row.getByText("Remove Ana from your friends?")).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await expect(row.getByRole("button", { name: "Yes, remove" })).toBeVisible();
    await row.getByRole("button", { name: "Cancel" }).click();
    await expect(details).not.toHaveAttribute("open", "");
    await row.locator("summary", { hasText: "Remove" }).click();
    await bobPage.keyboard.press("Escape");
    await expect(details).not.toHaveAttribute("open", "");
    await expect(row).toContainText("Ana");

    const regenerate = bobPage.locator("section", { hasText: "Your invite link" });
    const link = await inviteLink(bobPage);
    await regenerate.locator("summary", { hasText: "Regenerate" }).click();
    await expect(regenerate.getByText("The old link stops working at once")).toBeVisible();
    expect(await inviteLink(bobPage)).toBe(link); // asked, not done
  });

  test("AC-21: with JavaScript off the buttons are plain forms that still act, and the question still opens", async ({ browser }) => {
    const { anaPage, bobPage } = await requestedFriendship(browser);
    const noScript = await browser.newContext({ javaScriptEnabled: false, storageState: await anaPage.context().storageState() });
    const page = await noScript.newPage();
    await page.goto("/en/friends");
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(status(page)).toHaveText("Friend request approved.");
    await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0); // no JavaScript, no Cancel button

    await page.locator("summary", { hasText: "Remove" }).click(); // the browser opens a <details> itself
    await page.getByRole("button", { name: "Yes, remove" }).click();
    await expect(status(page)).toHaveText("Friend removed.");
    await expect(page.getByText("You haven't added any friends yet.")).toBeVisible();
    await noScript.close();
    await bobPage.reload();
    await expect(bobPage.getByText("You haven't added any friends yet.")).toBeVisible();
  });

  for (const width of [375, 320]) {
    test(`AC-20: at ${width} px every button is at least 44 px and the page does not scroll sideways`, async ({ browser }) => {
      const { anaPage, anaId, bobId } = await requestedFriendship(browser);
      psql(`update public.profiles set display_name = repeat('W', 40) where id in ('${anaId}', '${bobId}')`);
      await anaPage.setViewportSize({ width, height: 812 });
      for (const approved of [false, true]) {
        if (approved) await approve(anaPage);
        for (const locale of ["en", "ru", "hu"]) {
          await anaPage.goto(`/${locale}/friends`);
          await anaPage.locator("summary").first().click(); // the open question is the widest state
          const small = await anaPage.locator("button:visible, summary:visible").evaluateAll((els) =>
            els.map((el) => ({ text: el.textContent, ...el.getBoundingClientRect().toJSON() })).filter((r) => r.width < 44 || r.height < 44),
          );
          expect(small, `${locale} approved=${approved}`).toEqual([]);
          const overflow = await anaPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(overflow, `${locale} approved=${approved}`).toBeLessThanOrEqual(0);
        }
      }
    });
  }

  test("AC-20: a button changes colour under the pointer and again while it is pressed", async ({ browser }) => {
    const { anaPage } = await requestedFriendship(browser);
    await anaPage.goto("/en/friends");
    const approve = anaPage.getByRole("button", { name: "Approve" });
    const colour = () => approve.evaluate((el) => getComputedStyle(el).backgroundColor);
    const rest = await colour();
    await approve.hover();
    await expect.poll(colour).not.toBe(rest);
    const hover = await colour();
    await anaPage.mouse.down();
    await expect.poll(colour).not.toBe(hover);
    await anaPage.mouse.up();
  });
});
