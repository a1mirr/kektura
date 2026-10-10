try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: the variables may come from the environment
}

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
const base = process.env.TELEGRAM_API_BASE?.trim() || "https://api.telegram.org";
const findChatId = process.argv.includes("--find-chat-id");

class Problem extends Error {}

async function call(method, body = {}) {
  let response;
  try {
    response = await fetch(`${base}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new Problem(`Could not reach Telegram (${error instanceof Error ? error.name : "error"}). Check the network.`);
  }
  const answer = await response.json().catch(() => ({}));
  if (!response.ok || !answer.ok) {
    throw new Problem(`Telegram refused ${method}: ${answer.description ?? `HTTP ${response.status}`}`);
  }
  return answer.result;
}

async function main() {
  if (!token) {
    throw new Problem(
      [
        "TELEGRAM_BOT_TOKEN is not set. To create the bot:",
        "  1. In Telegram, open @BotFather and send /newbot (pick a name and a username).",
        "  2. Copy the token it gives you into .env.local as TELEGRAM_BOT_TOKEN=...",
        "  3. Send any message to your new bot, then run: npm run telegram:check -- --find-chat-id",
      ].join("\n"),
    );
  }

  const me = await call("getMe");
  console.log(`Token OK: the bot is @${me.username}.`);

  if (findChatId) {
    const chats = new Map();
    // Telegram refuses getUpdates while a webhook is registered: `npm run telegram:webhook -- delete` first.
    for (const update of await call("getUpdates")) {
      const chat = (update.message ?? update.channel_post ?? update.edited_message)?.chat;
      if (chat) chats.set(chat.id, chat);
    }
    if (chats.size === 0) {
      throw new Problem(`No chats yet: send any message to @${me.username} in Telegram, then run this again.`);
    }
    console.log("Chats that wrote to the bot (use the id as TELEGRAM_CHAT_ID):");
    for (const chat of chats.values()) {
      console.log(`  ${chat.id}  ${chat.type}  ${chat.title ?? chat.username ?? chat.first_name ?? ""}`);
    }
  } else {
    if (!chatId) throw new Problem("TELEGRAM_CHAT_ID is not set. Run: npm run telegram:check -- --find-chat-id");
    await call("sendMessage", { chat_id: chatId, text: "Kéktúra tracker: Telegram notifications work." });
    console.log("Test message sent. Feedback from the site will arrive in that chat.");
    const hook = await call("getWebhookInfo").catch(() => null);
    console.log(
      hook?.url
        ? `Flag commands: webhook registered (${hook.url}).`
        : "Flag commands: no webhook registered (npm run telegram:webhook -- set).",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Problem ? error.message : `Unexpected error (${error?.name ?? "unknown"}).`);
  process.exitCode = 1;
});
