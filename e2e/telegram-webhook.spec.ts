import { expect, test } from "@playwright/test";

// Spec 0035 AC-14, AC-26: the test server has neither the webhook secret nor the bot (spec 0006 AC-7), so the webhook
// does not exist there, whatever is sent to it. (What it does for the owner is unit-tested with a mocked database.)
test.describe("spec 0035: the Telegram webhook on the test server", () => {
  test("AC-14, AC-26: /api/telegram is an empty 404 with or without a secret header", async ({ request }) => {
    const update = { update_id: 1, message: { text: "/flags", chat: { id: 1 }, from: { id: 1 } } };
    for (const headers of [{} as Record<string, string>, { "x-telegram-bot-api-secret-token": "guess" }, { "x-telegram-bot-api-secret-token": "" }]) {
      const response = await request.post("/api/telegram", { data: update, headers });
      expect([response.status(), await response.text()]).toEqual([404, ""]);
    }
  });
});
