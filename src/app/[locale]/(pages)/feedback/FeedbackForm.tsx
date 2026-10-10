"use client";

import { useId, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { characterCount, messageLimit } from "@/lib/feedback";
import { submitFeedback, type FeedbackResult } from "./actions";

function messageKey(result: FeedbackResult) {
  if (result.ok) return "success";
  if (result.reason === "too_long") return "tooLong";
  if (result.reason === "rate_limited") return "rateLimited";
  return "error";
}

export default function FeedbackForm({ stamp = null }: { stamp?: { code: string; name: string } | null }) {
  const t = useTranslations("feedback");
  const locale = useLocale();
  const id = useId();
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot: people never see or fill it
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<FeedbackResult | null>(null);

  const max = messageLimit(stamp); // the stamp's line takes its share of the 2000
  const count = characterCount(message);
  const canSend = !sending && count > 0 && count <= max;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setSending(true);
    setResult(null);
    let answer: FeedbackResult;
    try {
      answer = await submitFeedback({ message, website, locale, stamp: stamp?.code });
    } catch {
      answer = { ok: false, reason: "failed" };
    }
    setSending(false);
    setResult(answer);
    if (answer.ok) setMessage("");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
      {stamp && (
        <p data-feedback-stamp className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 [overflow-wrap:anywhere]">
          {t("aboutStamp", { name: stamp.name, code: stamp.code })}
        </p>
      )}
      <label htmlFor={`${id}-message`} className="text-sm font-medium">
        {t("label")}
      </label>
      <textarea
        id={`${id}-message`}
        className="w-full rounded-md border border-stone-300 p-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        rows={6}
        maxLength={max}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t("placeholder")}
      />
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
        <span>{t("note")}</span>
        <span aria-label={t("counter", { count, max })} className="tabular-nums">
          {count} / {max}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={!canSend}
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {sending ? t("sending") : t("submit")}
        </button>
        {result && (
          <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-green-700" : "text-red-600"}`}>
            {t(messageKey(result))}
          </p>
        )}
      </div>
    </form>
  );
}
