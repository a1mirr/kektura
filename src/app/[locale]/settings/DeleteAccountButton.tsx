"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { deleteAccountAction } from "./actions";

export default function DeleteAccountButton() {
  const t = useTranslations("settings");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    const res = await deleteAccountAction();
    if (res.ok) {
      router.push("/");
    } else {
      setLoading(false);
      alert("Failed to delete account.");
    }
  };

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
    <div className="flex flex-col gap-2 rounded border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-semibold text-red-800">{t("deleteConfirm")}</p>
      <div className="flex items-center gap-3 mt-2">
        <button
          type="button"
          disabled={loading}
          onClick={handleDelete}
          className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {t("deleteButton")}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => setConfirming(false)}
          className="text-sm text-stone-600 hover:underline disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
