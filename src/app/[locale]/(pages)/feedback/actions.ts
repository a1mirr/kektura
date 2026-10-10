"use server";

import { headers } from "next/headers";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { FEEDBACK_MAX, formatFeedbackNotification, stampPrefix, validateFeedback } from "@/lib/feedback";
import { logFeedbackError, logFeedbackNotifyFailure } from "@/lib/log";
import { createRateLimiter } from "@/lib/rate-limit";
import { findStamp } from "@/lib/stamp-lookup";
import { createClient } from "@/lib/supabase/server";
import { sendTelegramMessage, telegramConfig } from "@/lib/telegram";

export type FeedbackResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "empty" | "too_long" | "rate_limited" | "failed" };

const ok: FeedbackResult = { ok: true };

const perIp = createRateLimiter({ limit: 5, windowMs: 10 * 60_000 });
const overall = createRateLimiter({ limit: 100, windowMs: 60 * 60_000 });

// Caddy puts the client address first in x-forwarded-for; without a proxy everyone shares a bucket.
const clientIp = (h: Headers) => h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";

// `website` is the honeypot: hidden from people, so a filled one is a bot, which gets a success answer and nothing
// else.
export async function submitFeedback(input: unknown): Promise<FeedbackResult> {
  try {
    if (typeof input !== "object" || input === null) return { ok: false, reason: "invalid" };
    const { message: raw, locale, website, stamp: rawStamp } = input as Record<string, unknown>;
    if (typeof website === "string" && website.trim() !== "") return ok;

    const checked = validateFeedback(raw);
    if (!checked.ok) return { ok: false, reason: checked.reason };

    if (!perIp.allow(clientIp(await headers())) || !overall.allow("all")) {
      return { ok: false, reason: "rate_limited" };
    }

    const stamp = rawStamp === undefined ? null : await findStamp(rawStamp);
    const message = stamp ? stampPrefix(stamp) + checked.message : checked.message;
    if ([...message].length > FEEDBACK_MAX) return { ok: false, reason: "too_long" };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // RLS only lets the row carry the caller's own user id (or none at all).
    const { error } = await supabase.from("user_feedback").insert({ user_id: user?.id ?? null, message });
    if (error) {
      logFeedbackError("write", error, user?.id);
      return { ok: false, reason: "failed" };
    }

    // The row is saved: from here on nothing may fail the submission.
    const config = telegramConfig();
    if (config) {
      const sent = await sendTelegramMessage(
        formatFeedbackNotification({
          message,
          locale: hasLocale(routing.locales, locale) ? locale : "?",
          senderEmail: user ? (user.email ?? `user ${user.id}`) : null,
        }),
        config,
      );
      if (!sent.ok) logFeedbackNotifyFailure(sent.reason);
    }
    return ok;
  } catch (error) {
    logFeedbackError("exception", error);
    return { ok: false, reason: "failed" };
  }
}
