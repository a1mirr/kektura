import { createHash, timingSafeEqual } from "node:crypto";

// Helpers of the Telegram webhook (spec 0035 AC-14 to AC-16): who may call it and what an update is. Pure, so the
// rules are unit-tested; the route (src/app/api/telegram/route.ts) only wires them together.

export const MAX_UPDATE_BYTES = 16 * 1024;

// Compares the secret header with the configured secret in constant time: both are hashed first, so the lengths
// match and nothing about the secret leaks through timing. An empty secret never matches.
export function secretMatches(given: string | null, expected: string | undefined): boolean {
  if (!expected || given === null) return false;
  const digest = (text: string) => createHash("sha256").update(text).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

export type TelegramUpdate = { updateId: number; chatId: string; fromId: string; text: string };

// The text message of an update, or null for anything else (no message, no text, wrong shapes).
export function parseUpdate(body: string): TelegramUpdate | null {
  if (body.length > MAX_UPDATE_BYTES) return null;
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  const update = json as { update_id?: unknown; message?: { text?: unknown; chat?: { id?: unknown }; from?: { id?: unknown } } };
  const message = update?.message;
  const ids = [update?.update_id, message?.chat?.id, message?.from?.id];
  if (typeof message?.text !== "string" || !ids.every((id) => typeof id === "number" && Number.isSafeInteger(id))) return null;
  return { updateId: update.update_id as number, chatId: String(message.chat!.id), fromId: String(message.from!.id), text: message.text };
}

// Only the owner is obeyed: the chat and the sender must both be the configured chat id (in a private chat they are
// the same number). Anyone can find the bot and write to it.
export const isOwner = (update: { chatId: string; fromId: string }, ownerChatId: string): boolean =>
  update.chatId === ownerChatId && update.fromId === ownerChatId;

// Remembers the last update ids, because Telegram can deliver the same one twice.
export function createSeenUpdates(capacity = 200) {
  const seen = new Set<number>();
  return {
    // True the first time an id is offered, false after.
    first(id: number): boolean {
      if (seen.has(id)) return false;
      seen.add(id);
      if (seen.size > capacity) seen.delete(seen.values().next().value as number);
      return true;
    },
  };
}

// A tap on one of the bot's buttons (spec 0035 AC-30): who tapped, which message it was under and the data it carries.
export type TelegramCallback = { updateId: number; chatId: string; fromId: string; callbackId: string; messageId: number; data: string };

export function parseCallback(body: string): TelegramCallback | null {
  if (body.length > MAX_UPDATE_BYTES) return null;
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  const query = (json as { callback_query?: { id?: unknown; data?: unknown; from?: { id?: unknown }; message?: { message_id?: unknown; chat?: { id?: unknown } } } })?.callback_query;
  const updateId = (json as { update_id?: unknown })?.update_id;
  const ids = [updateId, query?.from?.id, query?.message?.chat?.id, query?.message?.message_id];
  if (typeof query?.id !== "string" || typeof query.data !== "string" || !ids.every((id) => typeof id === "number" && Number.isSafeInteger(id))) return null;
  return {
    updateId: updateId as number,
    chatId: String(query.message!.chat!.id),
    fromId: String(query.from!.id),
    callbackId: query.id,
    messageId: query.message!.message_id as number,
    data: query.data,
  };
}
