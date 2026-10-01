"use client";

import { useTranslations } from "next-intl";
import type { ActionResult } from "@/lib/action-result";
import { useStampAction } from "@/lib/use-stamp-action";

// Button that runs a stamp server action: disabled while it runs, with a short message on failure.
// `done` = the thing is already stamped, so the button offers to undo it.
export default function ActionButton({
  action,
  done,
  accent = "blue",
  children,
}: {
  action: () => Promise<ActionResult>;
  done: boolean;
  accent?: "blue" | "amber";
  children: React.ReactNode;
}) {
  const t = useTranslations("dashboard");
  const { pending, failed, run } = useStampAction();
  const primary =
    accent === "amber" ? "bg-amber-600 text-white hover:bg-amber-700" : "bg-blue-600 text-white hover:bg-blue-700";

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
        onClick={() => run(action)}
        className={`shrink-0 rounded px-3 py-1 text-sm disabled:opacity-50 ${
          done ? "bg-stone-200 hover:bg-stone-300" : primary
        }`}
      >
        {children}
      </button>
    </>
  );
}
