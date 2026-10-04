// What the friends actions accept and answer, shared by the actions and the pages (spec 0024).

// AC-1: what the database constraint on profiles.display_name enforces (1 to 40 characters once trimmed,
// no control characters).
export function isValidDisplayName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 40 && !/[\u0000-\u001f\u007f-\u009f]/.test(name);
}

// The ids come from a client that can send anything; a bad one would otherwise reach Postgres and its error
// message, with the input in it, the log.
export const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// AC-3: why a request is refused, as send_request answers it.
export const REQUEST_REFUSALS = ["invalid_token", "own_token", "already_friends", "already_pending", "incoming_pending"] as const;
export type RequestRefusal = (typeof REQUEST_REFUSALS)[number];

// AC-17: what the Friends page says after an action went through. The page reads `?ok=<code>` and shows the
// message of a code on this list, never the value itself (like `?error=`).
export const FRIEND_NOTICES = ["sent", "approved", "ignored", "removed", "regenerated", "name", "sharing_on", "sharing_off"] as const;
export type FriendNotice = (typeof FRIEND_NOTICES)[number];

// Where an action sends the browser when it is done: back to the Friends page, with the notice on success and the
// reason on failure. The path has no locale (the caller adds it, or the localized `redirect` does).
export function friendsPath(result: { ok: true } | { ok: false; reason: string }, notice: FriendNotice): string {
  return result.ok ? `/friends?ok=${notice}` : `/friends?error=${result.reason}`;
}
