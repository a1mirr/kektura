// The request URL contains the bot token, so nothing here ever returns or logs the URL, a fetch error object or a
// response body: failures are reduced to a short reason.

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

export type InlineButton = { text: string; callback_data: string };
export type InlineKeyboard = InlineButton[][];

type CallOptions = { fetchImpl?: typeof fetch; timeoutMs?: number };

async function callApi(
  method: string,
  body: Record<string, unknown>,
  config: TelegramConfig,
  { fetchImpl = fetch, timeoutMs = 4000 }: CallOptions = {},
): Promise<TelegramResult> {
  try {
    const response = await fetchImpl(`${config.apiBase ?? DEFAULT_API}/bot${config.token}/${method}`, {
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

// Plain text on purpose: no parse_mode, so the sender's text can't be read as markup.
const cut = (text: string) => (text.length > TELEGRAM_MAX_TEXT ? `${text.slice(0, TELEGRAM_MAX_TEXT - 1)}…` : text);

export function sendTelegramMessage(
  text: string,
  config: TelegramConfig,
  { keyboard, ...options }: CallOptions & { keyboard?: InlineKeyboard } = {},
): Promise<TelegramResult> {
  return callApi(
    "sendMessage",
    {
      chat_id: config.chatId,
      text: cut(text),
      disable_web_page_preview: true,
      ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
    },
    config,
    options,
  );
}

export function editTelegramMessage(
  messageId: number,
  text: string,
  config: TelegramConfig,
  { keyboard, ...options }: CallOptions & { keyboard?: InlineKeyboard } = {},
): Promise<TelegramResult> {
  return callApi(
    "editMessageText",
    {
      chat_id: config.chatId,
      message_id: messageId,
      text: cut(text),
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: keyboard ?? [] },
    },
    config,
    options,
  );
}

// Every tap has to be answered, or the button keeps spinning; the optional text is a short notice at the top.
export function answerTelegramCallback(
  callbackId: string,
  text: string | undefined,
  config: TelegramConfig,
  options: CallOptions = {},
): Promise<TelegramResult> {
  return callApi("answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text: text.slice(0, 200) } : {}) }, config, options);
}
