"use client";

import { useId, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

const MARK = "⁣"; // an invisible separator standing in for the date while the message is split around it

// Spec 0001 AC-19: the date from which a place's stamp is required. The date is a button that opens the explanation, so it
// is reachable by tap and by keyboard, not by hover only. `waived`: the user walked it before that day.
export default function RequiredFrom({
  requiredFrom,
  waived,
  tolerance,
  who = "you",
}: {
  requiredFrom: string; // YYYY-MM-DD
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
  // The sentence is a translated message with the date in it; the date itself is the button.
  const [before, after] = t("requiredFrom", { date: MARK }).split(MARK);

  return (
    <div className="mt-1 text-xs text-stone-600 [overflow-wrap:anywhere]" onKeyDown={(e) => {
        if (e.key !== "Escape" || !open) return;
        e.preventDefault(); // this Escape closed the note: others (the mode of spec 0016 AC-14) leave it alone
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
      {/* Without JavaScript the button does nothing: the note is plain text then. */}
      <noscript>
        <p className="mt-1 rounded bg-stone-50 p-2">{explanation}</p>
      </noscript>
    </div>
  );
}
