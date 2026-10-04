// Tells the developer that the uptime check failed twice in a row (spec 0066), through the bot of spec 0017.
//
//   PREVIOUS_CONCLUSIONS                    the conclusions of the earlier completed runs, newest first, or `unknown`
//   RUN_URL                                 where to look
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID    the bot and the chat (both optional: without them nothing is sent)
//
// Sending goes through `notify` of notify-telegram.mjs, which never prints the token or an error object. Exits with 0
// even when nothing is sent: the run has already failed.
import { pathToFileURL } from "node:url";
import { alertMessage, shouldAlert } from "./lib/uptime.mjs";
import { notify } from "./notify-telegram.mjs";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = process.env;
  if (!shouldAlert(env.PREVIOUS_CONCLUSIONS)) {
    console.log("The previous run did not fail, or an outage was already announced: no message sent.");
  } else {
    const result = await notify({
      token: env.TELEGRAM_BOT_TOKEN?.trim(),
      chatId: env.TELEGRAM_CHAT_ID?.trim(),
      text: alertMessage({ runUrl: env.RUN_URL ?? "" }),
      base: env.TELEGRAM_API_BASE?.trim() || undefined,
    });
    console.log(result === "skipped" ? "Telegram is not configured: no message sent (GitHub's own failure e-mail still comes)." : `Telegram: ${result}`);
  }
}
