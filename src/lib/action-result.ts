export type ActionResult = { ok: true } | { ok: false; reason: "unauthorized" | "failed" | "disabled" };
