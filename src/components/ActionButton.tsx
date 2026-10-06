"use client";

import { useOptimistic } from "react";
import { useTranslations } from "next-intl";
import type { ActionResult } from "@/lib/action-result";
import { useStampAction } from "@/lib/use-stamp-action";

// Button that runs a stamp server action: disabled while it runs, with a short message on failure.
// `done` = the thing is already stamped, so the button offers to undo it. On click it shows the new
// state at once (optimistic, spec 0002 AC-13): the other label and style until the server answers; a
// failed action puts the old state back. The stats and the map are never touched optimistically.
export default function ActionButton({
  action,
  done,
  doneLabel,
  todoLabel,
  accent = "blue",
  ariaLabel,
}: {
  action: () => Promise<ActionResult>;
  done: boolean;
  doneLabel: string; // shown while `done` (the undo label)
  todoLabel: string; // shown while not `done`
  accent?: "blue" | "amber";
  ariaLabel?: string; // the accessible name, when the visible label alone does not say what it acts on
}) {
  const t = useTranslations("dashboard");
  const { pending, failed, run } = useStampAction();
  const [shownDone, setShownDone] = useOptimistic(done);
  const primary =
    accent === "amber" ? "bg-amber-700 text-white hover:bg-amber-800" : "bg-blue-600 text-white hover:bg-blue-700";

  return (
    <>
      {failed && (
        <span role="alert" className="text-xs text-red-600">
          {t("actionFailed")}
        </span>
      )}
      <button
        type="button"
        disabled={pending}
        aria-label={ariaLabel}
        onClick={() => run(action, () => setShownDone(!done))}
        className={`shrink-0 rounded px-3 py-1 text-sm disabled:opacity-50 ${
          shownDone ? "bg-stone-200 hover:bg-stone-300" : primary
        }`}
      >
        {shownDone ? doneLabel : todoLabel}
      </button>
    </>
  );
}
