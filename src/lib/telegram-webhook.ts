import { createHash, timingSafeEqual } from "node:crypto";

export const MAX_UPDATE_BYTES = 16 * 1024;

// Compares the secret header with the configured secret in constant time: both are hashed first, so the lengths
// match and nothing about the secret leaks through timing. An empty secret never matches.
export function secretMatches(given: string | null, expected: string | undefined): boolean {
  if (!expected || given === null) return false;
  const digest = (text: string) => createHash("sha256").update(text).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

export type TelegramUpdate = { updateId: number; chatId: string; fromId: string; text: string };

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

// Anyone can find the bot and write to it.
export const isOwner = (update: { chatId: string; fromId: string }, ownerChatId: string): boolean =>
  update.chatId === ownerChatId && update.fromId === ownerChatId;

// Remembers the last update ids, because Telegram can deliver the same one twice.
export function createSeenUpdates(capacity = 200) {
  const seen = new Set<number>();
  return {
    first(id: number): boolean {
      if (seen.has(id)) return false;
      seen.add(id);
      if (seen.size > capacity) seen.delete(seen.values().next().value as number);
      return true;
    },
  };
}

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
