// What the database constraint on profiles.display_name enforces (1 to 40 characters once trimmed, no control
// characters).
export function isValidDisplayName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 40 && !/[\u0000-\u001f\u007f-\u009f]/.test(name);
}

// The ids come from a client that can send anything; a bad one would otherwise reach Postgres and its error
// message, with the input in it, the log.
export const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export const REQUEST_REFUSALS = ["invalid_token", "own_token", "already_friends", "already_pending", "incoming_pending"] as const;
export type RequestRefusal = (typeof REQUEST_REFUSALS)[number];

// The page reads `?ok=<code>` and shows the message of a code on this list, never the value itself (like `?error=`).
export const FRIEND_NOTICES = ["sent", "approved", "ignored", "removed", "regenerated", "name", "sharing_on", "sharing_off"] as const;
export type FriendNotice = (typeof FRIEND_NOTICES)[number];

// The path has no locale (the caller adds it, or the localized `redirect` does).
export function friendsPath(result: { ok: true } | { ok: false; reason: string }, notice: FriendNotice): string {
  return result.ok ? `/friends?ok=${notice}` : `/friends?error=${result.reason}`;
}
