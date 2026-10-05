import { createFlagBot, type FlagAdminStore } from "@/lib/flag-commands";
import { createRateLimiter } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import { sendTelegramMessage, telegramConfig } from "@/lib/telegram";
import { createSeenUpdates, isOwner, MAX_UPDATE_BYTES, parseUpdate, secretMatches } from "@/lib/telegram-webhook";

// The Telegram webhook (spec 0035 AC-14 to AC-25): the owner switches feature flags by writing to the feedback bot.
// Under /api, so the proxy (and the language routing) leaves it alone.

const seen = createSeenUpdates();
const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

function database() {
  const supabase = createServiceClient();
  if (!supabase) throw new Error("service role key is not configured");
  return supabase;
}

// What the commands run against: the service role client, through the functions of migration 0062 (AC-23).
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
};

// One bot for the process: its pending /confirm lives here, in memory, for 60 seconds.
const bot = createFlagBot({ store });
const NOT_CONFIGURED = "Flag commands are not configured on the server (SUPABASE_SERVICE_ROLE_KEY is missing).";

const empty = (status: number) => new Response(null, { status });

export async function POST(request: Request): Promise<Response> {
  const config = telegramConfig();
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  // Without the secret configured, or without the right header, the address does not exist (AC-14).
  if (!config || !secret || !secretMatches(request.headers.get("x-telegram-bot-api-secret-token"), secret)) return empty(404);

  // From here on Telegram always gets a 200, whatever the command did, so it does not retry (AC-16).
  try {
    if (Number(request.headers.get("content-length") ?? 0) > MAX_UPDATE_BYTES) return empty(200);
    const update = parseUpdate(await request.text());
    if (!update || !seen.first(update.updateId) || !isOwner(update, config.chatId) || !limiter.allow("owner")) return empty(200);

    const reply = createServiceClient() ? await bot.handle(update.text) : NOT_CONFIGURED;
    // The answer goes out after the database has accepted the change (AC-22). Its failure is only a missing reply.
    await sendTelegramMessage(reply, config);
  } catch {
    // Never thrown to Telegram, never logged: an error here could carry the message text.
  }
  return empty(200);
}
