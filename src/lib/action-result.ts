// What the stamp server actions return instead of throwing: a thrown error reaches the client as an
// opaque message, so "session expired" couldn't be told apart from a failed write.
export type ActionResult = { ok: true } | { ok: false; reason: "unauthorized" | "failed" };
