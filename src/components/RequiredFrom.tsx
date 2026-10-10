"use client";

import { useId, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

const MARK = "⁣"; // an invisible separator standing in for the date while the message is split around it

export default function RequiredFrom({
  requiredFrom,
  waived,
  tolerance,
  who = "you",
}: {
  requiredFrom: string;
  waived: boolean;
  tolerance: boolean;
  who?: "you" | "friend";
}) {
  const t = useTranslations("dashboard");
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const explanationId = useId();
  // The date is a calendar day, not a moment: read and written in UTC so no time zone moves it.
  const date = format.dateTime(new Date(`${requiredFrom}T00:00:00Z`), { dateStyle: "long", timeZone: "UTC" });

  const explanation = t("requiredWhy") + (tolerance ? ` ${t("requiredTolerance")}` : "");
  const [before, after] = t("requiredFrom", { date: MARK }).split(MARK);

  return (
    <div className="mt-1 text-xs text-stone-600 [overflow-wrap:anywhere]" onKeyDown={(e) => {
        if (e.key !== "Escape" || !open) return;
        e.preventDefault(); // this Escape closed the note: others (the "Change dates" mode) leave it alone
        setOpen(false);
      }}>
      <p>
        {before}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={explanationId}
          aria-label={`${date}. ${t("requiredAbout")}`}
          onClick={() => setOpen(!open)}
          className="font-medium text-blue-700 underline decoration-dotted underline-offset-2"
        >
          {date}
        </button>
        {after}
      </p>
      <p>
        {waived ? (
          <span className="inline-block rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-900">
            {t(who === "friend" ? "notRequiredFriend" : "notRequired")}
          </span>
        ) : (
          t(who === "friend" ? "requiredHintFriend" : "requiredHint")
        )}
      </p>
      <p id={explanationId} hidden={!open} className="mt-1 rounded bg-stone-50 p-2">
        {explanation}
      </p>
      <noscript>
        <p className="mt-1 rounded bg-stone-50 p-2">{explanation}</p>
      </noscript>
    </div>
  );
}
