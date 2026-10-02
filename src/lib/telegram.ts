// Telegram Bot API client for the feedback notifications (spec 0017). Only `sendMessage` is needed.
//
// The request URL contains the bot token, so nothing here ever returns or logs the URL, a fetch error
// object or a response body: failures are reduced to a short reason.

export const TELEGRAM_MAX_TEXT = 4096; // characters per message
const DEFAULT_API = "https://api.telegram.org";

export type TelegramConfig = { token: string; chatId: string; apiBase?: string };

// Configured only when both values are set; otherwise feedback is just stored.
export function telegramConfig(env: Record<string, string | undefined> = process.env): TelegramConfig | null {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return null;
  return { token, chatId, apiBase: env.TELEGRAM_API_BASE?.trim() || undefined };
}

export type TelegramResult = { ok: true } | { ok: false; reason: string };

export async function sendTelegramMessage(
  text: string,
  config: TelegramConfig,
  { fetchImpl = fetch, timeoutMs = 4000 }: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<TelegramResult> {
  const body = {
    chat_id: config.chatId,
    // Plain text on purpose: no parse_mode, so the sender's text can't be read as markup.
    text: text.length > TELEGRAM_MAX_TEXT ? `${text.slice(0, TELEGRAM_MAX_TEXT - 1)}…` : text,
    disable_web_page_preview: true,
  };
  try {
    const response = await fetchImpl(`${config.apiBase ?? DEFAULT_API}/bot${config.token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok ? { ok: true } : { ok: false, reason: `http_${response.status}` };
  } catch (error) {
    return { ok: false, reason: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network" };
  }
}
