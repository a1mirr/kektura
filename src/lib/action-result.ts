// Returned instead of thrown: a thrown error reaches the client as an opaque message.
export type ActionResult = { ok: true } | { ok: false; reason: "unauthorized" | "failed" | "disabled" };
