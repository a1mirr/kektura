// Registers, shows or removes the Telegram webhook of the flag commands (spec 0035 AC-26).
//
//   npm run telegram:webhook -- set      tell Telegram to send the bot's messages to SITE_URL/api/telegram
//   npm run telegram:webhook -- info     show where Telegram sends them and whether it had trouble
//   npm run telegram:webhook -- delete   stop sending them (the bot works again for getUpdates)
//
// Reads TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and SITE_URL from .env.local (or the environment). The request URL
// holds the token and the secret goes to Telegram in the body, so neither is ever printed: only what Telegram answers.
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: the variables may come from the environment
}

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
const site = process.env.SITE_URL?.trim().replace(/\/+$/, "");
const base = process.env.TELEGRAM_API_BASE?.trim() || "https://api.telegram.org";
const action = process.argv[2];

// A problem to tell the user about. Thrown, not process.exit(): on Windows, exiting while a fetch
// connection is still closing crashes Node with a libuv assertion.
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
    // The error's message can contain the request URL, so only its name is shown.
    throw new Problem(`Could not reach Telegram (${error instanceof Error ? error.name : "error"}). Check the network.`);
  }
  const answer = await response.json().catch(() => ({}));
  if (!response.ok || !answer.ok) {
    throw new Problem(`Telegram refused ${method}: ${answer.description ?? `HTTP ${response.status}`}`);
  }
  return answer.result;
}

async function info() {
  const hook = await call("getWebhookInfo");
  if (!hook.url) {
    console.log("No webhook is registered: the flag commands do not reach the site.");
    return;
  }
  console.log(`Webhook registered: ${hook.url}`);
  console.log(`Updates waiting: ${hook.pending_update_count ?? 0}`);
  if (hook.last_error_message) console.log(`Last error from the site: ${hook.last_error_message}`);
}

async function main() {
  if (!["set", "info", "delete"].includes(action)) throw new Problem("Usage: npm run telegram:webhook -- set|info|delete");
  if (!token) throw new Problem("TELEGRAM_BOT_TOKEN is not set (.env.local or the environment).");

  if (action === "info") return info();

  if (action === "delete") {
    await call("deleteWebhook");
    console.log("Webhook removed.");
    return;
  }

  if (!secret) throw new Problem("TELEGRAM_WEBHOOK_SECRET is not set. A secret of your own, 1 to 256 characters of A-Z a-z 0-9 _ -.");
  if (!/^[\w-]{1,256}$/.test(secret)) throw new Problem("TELEGRAM_WEBHOOK_SECRET may only hold A-Z a-z 0-9 _ - (1 to 256 characters).");
  if (!site || !/^https:\/\//.test(site)) throw new Problem("SITE_URL must be the public https address of the site, e.g. https://kektura-tracker.com.");
  await call("setWebhook", { url: `${site}/api/telegram`, secret_token: secret, allowed_updates: ["message", "callback_query"] });
  console.log(`Webhook registered for ${site}/api/telegram.`);
}

main().catch((error) => {
  console.error(error instanceof Problem ? error.message : `Unexpected error (${error?.name ?? "unknown"}).`);
  process.exitCode = 1;
});
