"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { setStampDates } from "@/app/[locale]/dashboard/actions";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/action-result";
import { canApply, notStampedCount, requestOf, retiredConflicts } from "@/lib/bulk-dates";
import { isValidStampDate } from "@/lib/stamp-date";
import { useBulk, type BulkApi } from "./BulkDatesProvider";
import CalendarButton from "./CalendarButton";

// The answer to a save (spec 0016 AC-19): "12 dates set". A status live region that is always in the page, so a screen reader
// announces its text when it appears; empty, it takes no room. It has no role of its own: the page already has one status (the test
// server's banner) and the others look for it.
export function BulkMessage() {
  const bulk = useBulk();
  const t = useTranslations("dashboard");
  if (!bulk) return null;
  return (
    <div aria-live="polite" className={bulk.saved ? "rounded-lg bg-green-50 p-4 text-green-800" : "sr-only"}>
      {bulk.saved && t("bulkSaved", { count: bulk.saved.count })}
    </div>
  );
}

// Hides the toolbar on a phone while the page is scrolled down and brings it back on the way up (or when something in it takes the
// focus), so it does not cost the small screen a strip all the time. The scroll direction is read from window.scrollY.
function useHideOnScrollDown() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 8) return; // a nudge is not a direction
      setHidden(y > last && y > 120);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return [hidden, () => setHidden(false)] as const;
}

// The toolbar of the stage list (spec 0016 AC-14): the list's controls, with the button into "Set dates", stuck to the top of the page
// while the list scrolls, extra stamps included. In the mode the bar sits under it on a wide screen (on a phone it is fixed to the
// bottom, spec 0016 AC-21). A friend's page has no provider and so no bar: the controls just stand there. From 1024 px it is at z-5:
// above the rows' positioned controls (the date fields) and below the map's block of the other column (z-10), which holds the
// fullscreen map, so the map covers it (spec 0003 AC-11).
export function BulkToolbar({ children }: { children: ReactNode }) {
  const bulk = useBulk();
  const [hidden, show] = useHideOnScrollDown();
  if (!bulk) return <div className="py-2">{children}</div>;
  const away = hidden && !bulk.active;
  return (
    <div
      data-hidden={away || undefined}
      onFocusCapture={show}
      className="sticky top-0 z-20 -mx-2 bg-stone-50 px-2 py-2 transition-[top] motion-reduce:transition-none max-lg:data-hidden:-top-40 lg:z-5"
    >
      {children}
      {bulk.active && <Bar bulk={bulk} />}
    </div>
  );
}

// How far the on-screen keyboard covers the bottom of the layout viewport: the bar is fixed to the bottom on a phone, and a
// keyboard that only shrinks the visual viewport (Chrome and Safari do) would hide it. Not while the page is pinch-zoomed.
function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setInset(viewport.scale > 1.01 ? 0 : Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

// On a phone the bar is fixed to the bottom of the screen; from 1024 px it stands under the toolbar, inside its sticky box.
// Mounted only while the mode is on, so its date and its failure start empty every time the mode opens.
function Bar({ bulk }: { bulk: BulkApi }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const inset = useKeyboardInset();
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const sending = useRef(false); // closes the gap before `pending` shows: a second press sends nothing
  const { chosen } = bulk;
  const conflicts = retiredConflicts(chosen, draft);
  const fresh = notStampedCount(chosen);
  const region = useRef<HTMLDivElement>(null);
  useEffect(() => region.current?.focus({ preventScroll: true }), []); // opened by the button: the focus moves into the bar
  const ready = canApply(chosen, draft) && !pending;

  // Nothing is sent before Apply, and never on `change` (spec 0016 AC-16).
  function apply() {
    if (!ready || sending.current) return;
    sending.current = true;
    bulk.setBusy(true);
    setFailed(false);
    const { placeKeys, extraIds } = requestOf(chosen);
    const count = chosen.length;
    start(async () => {
      let result: ActionResult;
      try {
        result = await setStampDates(placeKeys, extraIds, draft);
      } catch {
        result = { ok: false, reason: "failed" }; // network error
      }
      sending.current = false;
      bulk.setBusy(false);
      if (result.ok) bulk.finish(count);
      else if (result.reason === "unauthorized") router.refresh(); // the session expired: the page sends the user to the landing page
      else setFailed(true); // the dates and the choice stay as they were
    });
  }

  const link = "inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-sm text-blue-700 hover:underline disabled:opacity-50 lg:min-h-8 lg:min-w-0";
  return (
    <div
      ref={region}
      tabIndex={-1}
      role="region"
      aria-label={t("bulkBar")}
      aria-busy={pending}
      style={{ "--kb": `${inset}px` } as CSSProperties}
      className="rounded-lg bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg outline-none ring-1 ring-stone-300 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-(--kb) max-lg:mb-0 max-lg:z-30 max-lg:rounded-b-none lg:mt-2"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p role="status" className="text-sm font-semibold tabular-nums">
          {t("bulkSelected", { count: chosen.length })}
          {fresh > 0 && ` · ${t("bulkNew", { count: fresh })}`}
        </p>
        <button type="button" onClick={bulk.selectAll} className={link}>
          {t("bulkSelectAll")}
        </button>
        <button type="button" onClick={bulk.clear} disabled={chosen.length === 0} className={link}>
          {t("bulkClear")}
        </button>
        <button type="button" onClick={bulk.exit} disabled={pending} className={`${link} ml-auto`}>
          {t("bulkCancel")}
        </button>
      </div>
      <form
        className="mt-1 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault(); // Enter in the date field applies
          apply();
        }}
      >
        <input
          type="text"
          autoComplete="off"
          placeholder="yyyy-mm-dd"
          maxLength={10}
          aria-label={t("bulkDate")}
          aria-invalid={draft !== "" && !isValidStampDate(draft)}
          aria-describedby={conflicts.length > 0 ? "bulk-conflict" : undefined}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setFailed(false);
          }}
          className="h-11 w-36 rounded border border-stone-300 px-3 text-base tabular-nums lg:h-9 lg:text-sm"
        />
        <CalendarButton
          large
          value={isValidStampDate(draft) ? draft : ""}
          max={bulk.max}
          onPick={(date) => {
            if (date) setDraft(date); // a pick is a date, not a save: Apply sends it
          }}
        />
        <button
          type="submit"
          disabled={!ready}
          className="h-11 rounded bg-blue-600 px-5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 lg:h-9"
        >
          {pending ? t("bulkSaving") : t("bulkApply")}
        </button>
        {failed && (
          <span role="alert" className="text-sm text-red-600">
            {t("actionFailed")}
          </span>
        )}
      </form>
      {conflicts.length > 0 && (
        <p id="bulk-conflict" className="mt-1 text-sm text-red-700 [overflow-wrap:anywhere]">
          {t("bulkRetiredConflict", { names: conflicts.map((c) => c.name).join(", ") })}
        </p>
      )}
    </div>
  );
}
