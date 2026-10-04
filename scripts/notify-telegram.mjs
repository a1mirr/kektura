// Tells the developer that a deploy failed (spec 0026 AC-9), through the bot of spec 0017.
//
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID  the bot and the chat (both optional: without them nothing is sent)
//   DEPLOY_SHA, RUN_URL                    what failed and where to look
//   MIGRATE_OUTCOME, PUSH_OUTCOME, ...     the outcome of each step (`failure` names the failed one)
//
// The request URL contains the token, so it is never printed, and neither is an error object (its message can
// contain the URL): only what Telegram answers. Exits with 0 even when sending fails: the workflow has already failed.
import { pathToFileURL } from "node:url";
import { failureMessage } from "./lib/deploy.mjs";

/**
 * Sends `text`; returns "sent", "skipped" (not configured) or a short description of what went wrong.
 * @param {{ token?: string, chatId?: string, text: string, base?: string, fetchFn?: typeof fetch }} options
 * @returns {Promise<string>}
 */
export async function notify({ token, chatId, text, base = "https://api.telegram.org", fetchFn = fetch }) {
  if (!token || !chatId) return "skipped";
  try {
    const response = await fetchFn(`${base}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(15_000),
    });
    const answer = await response.json().catch(() => ({}));
    return response.ok && answer.ok ? "sent" : `Telegram refused the message: ${answer.description ?? `HTTP ${response.status}`}`;
  } catch (error) {
    return `Could not reach Telegram (${error instanceof Error ? error.name : "error"})`;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = process.env;
  const text = failureMessage({
    sha: env.DEPLOY_SHA ?? "",
    runUrl: env.RUN_URL ?? "",
    outcomes: { pick: env.PICK_OUTCOME, ci: env.CI_OUTCOME, plan: env.PLAN_OUTCOME, missing: env.MISSING_OUTCOME, backup: env.BACKUP_OUTCOME, migrate: env.MIGRATE_OUTCOME, push: env.PUSH_OUTCOME, smoke: env.SMOKE_OUTCOME },
  });
  const result = await notify({
    token: env.TELEGRAM_BOT_TOKEN?.trim(),
    chatId: env.TELEGRAM_CHAT_ID?.trim(),
    text,
    base: env.TELEGRAM_API_BASE?.trim() || undefined,
  });
  console.log(result === "skipped" ? "Telegram is not configured: no message sent (GitHub's own failure e-mail still comes)." : `Telegram: ${result}`);
}
