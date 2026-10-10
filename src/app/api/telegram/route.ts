import { createFlagBot, type FlagAdminStore } from "@/lib/flag-commands";
import { createRateLimiter } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import { answerTelegramCallback, editTelegramMessage, sendTelegramMessage, telegramConfig } from "@/lib/telegram";
import { createSeenUpdates, isOwner, MAX_UPDATE_BYTES, parseCallback, parseUpdate, secretMatches } from "@/lib/telegram-webhook";

const seen = createSeenUpdates();
const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

function database() {
  const supabase = createServiceClient();
  if (!supabase) throw new Error("service role key is not configured");
  return supabase;
}

const store: FlagAdminStore = {
  async list() {
    const { data, error } = await database().rpc("admin_list_feature_flags");
    if (error) throw error;
    return data.map((row) => ({ key: row.key, mode: row.mode, users: Number(row.users) }));
  },
  async setMode(key, mode) {
    const { data, error } = await database().rpc("admin_set_feature_flag", { p_key: key, p_mode: mode });
    if (error) throw error;
    if (data !== "ok") throw new Error("the database refused the mode");
  },
  async setUser(key, email, allowed) {
    const { data, error } = await database().rpc("admin_set_feature_flag_user", { p_key: key, p_email: email, p_allowed: allowed });
    if (error) throw error;
    if (data !== "ok" && data !== "no_account" && data !== "no_flag") throw new Error("the database refused the change");
    return data;
  },
  async listUsers(key) {
    const { data, error } = await database().rpc("admin_list_feature_flag_users", { p_key: key });
    if (error) throw error;
    return data.map((row) => ({ id: row.user_id, name: row.display_name }));
  },
  async removeUser(key, userId) {
    const { data, error } = await database().rpc("admin_remove_feature_flag_user", { p_key: key, p_user_id: userId });
    if (error) throw error;
    if (data !== "ok" && data !== "not_listed") throw new Error("the database refused the change");
    return data;
  },
};

// One bot for the process: its pending /confirm lives here, in memory, for 60 seconds.
const bot = createFlagBot({ store });
const NOT_CONFIGURED = "Flag commands are not configured on the server (SUPABASE_SERVICE_ROLE_KEY is missing).";

const empty = (status: number) => new Response(null, { status });

// Any other method is as absent as the address: Next would answer 405 for a method the route does not export, which
// shows that something lives here.
export const GET = () => empty(404);
export const HEAD = GET;
export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
export const OPTIONS = GET;

export async function POST(request: Request): Promise<Response> {
  const config = telegramConfig();
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!config || !secret || !secretMatches(request.headers.get("x-telegram-bot-api-secret-token"), secret)) return empty(404);

  // From here on Telegram always gets a 200, whatever the command did, so it does not retry.
  try {
    if (Number(request.headers.get("content-length") ?? 0) > MAX_UPDATE_BYTES) return empty(200);
    const body = await request.text();
    const message = parseUpdate(body);
    const tap = message ? null : parseCallback(body);
    const update = message ?? tap;
    if (!update || !seen.first(update.updateId) || !isOwner(update, config.chatId) || !limiter.allow("owner")) return empty(200);

    const configured = createServiceClient() !== null;
    if (message) {
      const reply = configured ? await bot.handle(message.text) : { text: NOT_CONFIGURED };
      await sendTelegramMessage(reply.text, config, { keyboard: reply.keyboard });
    } else if (tap) {
      const { reply, notice } = configured ? await bot.press(tap.data) : { reply: undefined, notice: "Not configured" };
      try {
        if (reply) await editTelegramMessage(tap.messageId, reply.text, config, { keyboard: reply.keyboard });
      } finally {
        await answerTelegramCallback(tap.callbackId, notice, config);
      }
    }
  } catch {
    // Never thrown to Telegram, never logged: an error here could carry the message text.
  }
  return empty(200);
}
