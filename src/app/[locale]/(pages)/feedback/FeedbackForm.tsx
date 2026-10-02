"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { submitFeedback } from "./actions";

export default function FeedbackForm() {
  const t = useTranslations("feedback");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setStatus("loading");
    const result = await submitFeedback(message);
    if (result.ok) {
      setStatus("success");
      setMessage("");
    } else {
      setStatus("error");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <textarea
        className="w-full rounded-md border border-stone-300 p-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        rows={5}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t("placeholder")}
        disabled={status === "loading" || status === "success"}
      />
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={status === "loading" || status === "success" || !message.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {t("submit")}
        </button>
        {status === "success" && <span className="text-sm text-green-600">{t("success")}</span>}
        {status === "error" && <span className="text-sm text-red-600">{t("error")}</span>}
      </div>
    </form>
  );
}
