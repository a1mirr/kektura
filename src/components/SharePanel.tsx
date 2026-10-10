"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createShareCard, deleteShareCard } from "@/app/[locale]/stats/actions";
import { useRouter } from "@/i18n/navigation";
import { SHARE_CARD_LIMIT } from "@/lib/share-card";

// One of the user's cards, written out on the server (the dates and numbers in the page's language).
export type ShareItem = { id: string; url: string; telegramUrl: string; line: string; created: string; named: boolean };

type Notice = "limit" | "failed" | null;

const button = "rounded px-3 py-1 text-sm disabled:opacity-50";
const primary = `${button} bg-blue-600 text-white hover:bg-blue-700`;
const secondary = `${button} bg-stone-200 hover:bg-stone-300`;

// The server action takes the numbers from the user's own stamps; this only says whether the name is shown.
export default function SharePanel({ items }: { items: ShareItem[] }) {
  const t = useTranslations("share");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showName, setShowName] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const fields = useRef(new Map<string, HTMLInputElement>());

  function create() {
    setNotice(null);
    startTransition(async () => {
      const result = await createShareCard(showName);
      if (result.ok) router.refresh();
      else setNotice(result.reason === "limit" ? "limit" : "failed");
    });
  }

  function remove(id: string) {
    setNotice(null);
    setConfirming(null);
    startTransition(async () => {
      const result = await deleteShareCard(id);
      if (result.ok) router.refresh();
      else setNotice("failed");
    });
  }

  // The clipboard needs a secure page and a user gesture; when it refuses, the link is selected so Ctrl+C works.
  async function copy(item: ShareItem) {
    try {
      await navigator.clipboard.writeText(item.url);
      setCopied(item.id);
      setTimeout(() => setCopied((id) => (id === item.id ? null : id)), 2000);
    } catch {
      fields.current.get(item.id)?.select();
    }
  }

  return (
    <section aria-labelledby="share-title" className="space-y-4 rounded-lg bg-white p-4 shadow-sm">
      <div>
        <h2 id="share-title" className="font-semibold">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-stone-600">{t("intro")}</p>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} />
          {t("showName")}
        </label>
        <p className="text-sm text-stone-600">{t("notice")}</p>
        <button type="button" onClick={create} disabled={pending} className={primary}>
          {t("create")}
        </button>
        {notice && (
          <p role="alert" className="text-sm text-red-600">
            {notice === "limit" ? t("limit", { count: SHARE_CARD_LIMIT }) : t("failed")}
          </p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold">{t("yourCards")}</h3>
        {items.length === 0 ? (
          <p className="mt-1 text-sm text-stone-500">{t("none")}</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {items.map((item) => (
              <li key={item.id} className="space-y-2 rounded border border-stone-200 p-3">
                <p className="text-sm font-medium">{item.line}</p>
                <p className="text-xs text-stone-500">
                  {item.created} · {item.named ? t("withName") : t("anonymous")}
                </p>
                <input
                  ref={(el) => {
                    if (el) fields.current.set(item.id, el);
                    else fields.current.delete(item.id);
                  }}
                  readOnly
                  value={item.url}
                  aria-label={t("linkLabel")}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded border border-stone-300 bg-stone-50 px-2 py-1 text-sm"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => copy(item)} className={primary}>
                    {copied === item.id ? t("copied") : t("copy")}
                  </button>
                  <a href={item.telegramUrl} target="_blank" rel="noopener noreferrer" className={secondary}>
                    {t("telegram")}
                  </a>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className={secondary}>
                    {t("open")}
                  </a>
                  {confirming === item.id ? (
                    <span role="group" aria-label={t("deleteQuestion")} className="flex flex-wrap items-center gap-2">
                      <span className="text-sm">{t("deleteQuestion")}</span>
                      <button type="button" onClick={() => remove(item.id)} disabled={pending} className={`${button} bg-red-700 text-white hover:bg-red-800`}>
                        {t("deleteConfirm")}
                      </button>
                      <button type="button" onClick={() => setConfirming(null)} className={secondary}>
                        {t("cancel")}
                      </button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirming(item.id)} className={`${button} text-red-700 hover:underline`}>
                      {t("delete")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
