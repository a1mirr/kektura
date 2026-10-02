import { test, expect } from "@playwright/test";
import { signInAsNewUser } from "./helpers";

test("spec 0024: Approval Model flow", async ({ browser }) => {
  // Inviter context
  const inviterContext = await browser.newContext();
  const inviterPage = await inviterContext.newPage();
  await signInAsNewUser(inviterPage);
  
  // Inviter goes to friends page and gets invite link
  await inviterPage.goto("/en/friends");
  const inviteLinkEl = inviterPage.locator("input[readonly]");
  await expect(inviteLinkEl).toBeVisible();
  const inviteUrl = await inviteLinkEl.inputValue();

  // Incognito user clicks -> signs in
  const friendContext = await browser.newContext();
  const friendPage = await friendContext.newPage();
  
  // They go to the invite URL
  await friendPage.goto(inviteUrl.replace("3000", "3002"));
  
  // They should be redirected to login because they are signed out,
  // but we can just sign them in first to simplify the test.
  await signInAsNewUser(friendPage);
  await friendPage.goto(inviteUrl.replace("3000", "3002"));

  // Friend clicks "Send request"
  await friendPage.getByRole("button", { name: /Send request/i }).click();
  
  // It should redirect to /friends
  await expect(friendPage).toHaveURL(/\/en\/friends/);

  // Inviter sees request -> clicks "Approve"
  await inviterPage.reload();
  const pendingSection = inviterPage.locator("text=Pending requests").locator("..");
  await pendingSection.getByRole("button", { name: /Approve/i }).click();

  // Both see sharing
  await expect(inviterPage.locator("text=Sharing progress").first()).toBeVisible();
  
  await friendPage.reload();
  await expect(friendPage.locator("text=Sharing progress").first()).toBeVisible();
});

test("spec 0024: invalid link and own link", async ({ page }) => {
  await signInAsNewUser(page);
  
  // Invalid token
  await page.goto("/en/friends/invite/00000000000000000000000000000000");
  await expect(page.locator("text=This link is not valid")).toBeVisible();

  // Own token
  await page.goto("/en/friends");
  const inviteUrl = await page.locator("input[readonly]").inputValue();
  await page.goto(inviteUrl.replace("3000", "3002"));
  
  // UI should display that this is the user's own link
  await expect(page.locator("text=This is your own invite link")).toBeVisible();
});

