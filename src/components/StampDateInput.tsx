"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/action-result";
import { isValidStampDate } from "@/lib/stamp-date";
import CalendarButton from "./CalendarButton";

// It must not save on every change: typing one date over another passes through other complete dates (2026-09-02 on
// the way to 2026-09-26), and a disabled field would lose focus mid-typing. So a valid, changed value is saved after
// a pause or when the field is left; anything else is never sent and is restored on leaving. (A day picked in the
// calendar is one complete date and is saved at once.)

const SAVE_DELAY_MS = 700;

export default function StampDateInput({
  value,
  max,
  latest,
  onSave,
}: {
  value: string;
  max: string; // the latest date the server accepts (tomorrow, UTC)
  latest?: string; // a stricter last day, for a retired stamp: a later date is never sent
  onSave: (date: string) => Promise<ActionResult>;
}) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(value); // the last date known to be saved: from the server or our own save
  const [seen, setSeen] = useState(value); // the last `value` prop we looked at
  const valid = useCallback((date: string) => isValidStampDate(date) && (latest === undefined || date <= latest), [latest]);
  const [status, setStatus] = useState<"idle" | "saving" | "failed">("idle");

  // Follow the server's date when the prop *changes* (the page refreshed after a save, another tab edited
  // it), unless the user is in the middle of changing it. Comparing with `saved` instead would see our own
  // finished save as a change by the server and flip the field back to the old date until the refresh lands.
  if (value !== seen) {
    setSeen(value);
    if (draft === saved) setDraft(value);
    setSaved(value);
  }

  // The latest onSave without making it a dependency: parents pass a new function on every render, which
  // would restart the pause on each of their renders.
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  });

  const save = useCallback(
    async (date: string) => {
      setStatus("saving");
      let result: ActionResult;
      try {
        result = await onSaveRef.current(date);
      } catch {
        result = { ok: false, reason: "failed" };
      }
      if (result.ok) {
        setSaved(date);
        setStatus("idle");
      } else if (result.reason === "unauthorized") {
        setStatus("idle");
        router.refresh(); // the session expired: the page sends the user to the landing page
      } else {
        setDraft(saved);
        setStatus("failed");
      }
    },
    [router, saved],
  );

  // Save after a pause. One save at a time: when it ends this runs again for anything typed meanwhile.
  useEffect(() => {
    if (status === "saving" || draft === saved || !valid(draft)) return;
    const timer = setTimeout(() => void save(draft), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, saved, status, save, valid]);

  function handlePick(date: string) {
    if (!valid(date)) return;
    setDraft(date);
    if (status === "failed") setStatus("idle");
    if (date !== saved && status !== "saving") void save(date);
  }

  function handleBlur() {
    if (draft === saved) return;
    if (!valid(draft)) setDraft(saved); // empty, incomplete or out of range: back to the saved date
    else if (status !== "saving") void save(draft); // leaving the field saves at once (and stops the pause)
  }

  return (
    <>
      {status === "failed" && (
        <span role="alert" className="text-xs text-red-600">
          {t("actionFailed")}
        </span>
      )}
      <input
        type="text"
        autoComplete="off"
        placeholder="yyyy-mm-dd"
        maxLength={10}
        aria-label={t("stampDate")}
        aria-busy={status === "saving"}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (status === "failed") setStatus("idle");
        }}
        onBlur={handleBlur}
        className="w-28 rounded border border-stone-300 px-2 py-0.5 text-sm tabular-nums"
      />
      <CalendarButton value={valid(draft) ? draft : saved} max={max} onPick={handlePick} />
    </>
  );
}
