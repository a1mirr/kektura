"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/action-result";
import { deleteAccountAction } from "./actions";

// Two steps (AC-9): the button asks, the confirmation deletes. See specs/0014-pages-and-settings.md.
export default function DeleteAccountButton() {
  const t = useTranslations("settings");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    setFailed(false);
    let result: ActionResult;
    try {
      result = await deleteAccountAction();
    } catch {
      result = { ok: false, reason: "failed" }; // network error
    }
    if (result.ok) {
      router.replace("/"); // stays disabled while the page changes
      return;
    }
    setDeleting(false);
    if (result.reason === "unauthorized") router.refresh(); // session expired: the page redirects
    else setFailed(true);
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded border border-red-600 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        {t("deleteAccount")}
      </button>
    );
  }

  return (
    <div role="group" aria-label={t("deleteAccount")} className="flex flex-col gap-2 rounded border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-semibold text-red-800">{t("deleteConfirm")}</p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          disabled={deleting}
          onClick={handleDelete}
          className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {t("deleteButton")}
        </button>
        <button
          type="button"
          disabled={deleting}
          onClick={() => {
            setConfirming(false);
            setFailed(false);
          }}
          className="text-sm text-stone-600 hover:underline disabled:opacity-50"
        >
          {t("cancel")}
        </button>
      </div>
      {failed && (
        <p role="alert" className="text-sm text-red-700">
          {t("deleteFailed")}
        </p>
      )}
    </div>
  );
}
