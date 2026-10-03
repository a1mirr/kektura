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
