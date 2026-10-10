"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { MIN_STAMP_DATE } from "@/lib/stamp-date";

// The native picker lives in a hidden date input, opened from the button, and a pick is one complete date, handed to
// `onPick` at once. The hidden input is out of the keyboard's and the screen readers' way (the text field is the only
// date field they meet) and keeps the browser's own range limits.
export default function CalendarButton({
  value,
  max,
  onPick,
  large = false,
}: {
  value: string;
  max: string;
  onPick: (date: string) => void;
  large?: boolean;
}) {
  const t = useTranslations("dashboard");
  const picker = useRef<HTMLInputElement>(null);

  function openCalendar() {
    const input = picker.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === "function") input.showPicker();
      else input.click();
    } catch {
      input.click(); // showPicker() throws when the browser refuses (no user gesture, a sandboxed frame)
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={t("openCalendar")}
        onClick={openCalendar}
        className={`rounded text-stone-500 hover:bg-stone-100 hover:text-stone-800 ${large ? "inline-flex size-11 items-center justify-center" : "p-1"}`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
        </svg>
      </button>
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        min={MIN_STAMP_DATE}
        max={max}
        onChange={(e) => onPick(e.target.value)}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
    </span>
  );
}
