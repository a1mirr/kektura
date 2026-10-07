"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { accountMenuEntries, isCurrentPage } from "@/lib/account-menu";

const noSubscribe = () => () => {};

// The account menu of the header strip (spec 0014 AC-20 to AC-26): a disclosure, not an application menu. A native
// `<details>` opens and closes without script, so before hydration and with JavaScript off the entries are reachable (AC-23);
// once hydrated it adds `aria-expanded`, Escape, a click outside and closing on a followed link (AC-22). The list is plain
// links followed by the sign-out form, which is a plain POST like the one on the settings page (AC-26). The layout decides
// `friends` per request (flag `friends`, spec 0035), so a flagged entry never reaches a page that must answer 404.
export default function AccountMenu({ friends }: { friends: boolean }) {
  const t = useTranslations("accountMenu");
  const locale = useLocale();
  const pathname = usePathname();
  const details = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [openOn, setOpenOn] = useState(pathname);
  // `aria-expanded` is a script-time enhancement: the server's copy must not claim "closed" while the browser has opened
  // the `<details>` natively (AC-22).
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);

  // A tap before hydration opened the `<details>` natively and its `toggle` event went unheard: take the state from the element.
  const attach = useCallback((node: HTMLDetailsElement | null) => {
    details.current = node;
    if (node?.open) setOpen(true);
  }, []);

  // The layout stays mounted while the visitor moves between pages: a menu left open is closed by the move.
  if (openOn !== pathname) {
    setOpenOn(pathname);
    setOpen(false);
  }

  // A click or tap outside closes the list (AC-22). Subscribed only while it is open.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!details.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <details
      ref={attach}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          summary.current?.focus();
        }
      }}
      className="relative"
    >
      <summary
        ref={summary}
        aria-expanded={hydrated ? open : undefined}
        className="flex min-h-11 min-w-11 cursor-pointer list-none items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-900 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 [&::-webkit-details-marker]:hidden"
      >
        {t("label")}
        <svg aria-hidden viewBox="0 0 20 20" width="16" height="16" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <ul className="absolute right-0 top-full z-20 mt-1 w-max min-w-52 max-w-[calc(100vw-2rem)] rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
        {accountMenuEntries({ friends }).map((entry) => {
          const current = isCurrentPage(pathname, entry.href);
          return (
            <li key={entry.key}>
              <Link
                href={entry.href}
                aria-current={current ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`flex min-h-11 items-center px-4 text-sm hover:bg-stone-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700 ${
                  current ? "border-l-4 border-blue-700 bg-blue-50 pl-3 font-semibold text-blue-700" : "text-stone-900"
                }`}
              >
                {t(entry.key)}
              </Link>
            </li>
          );
        })}
        <li className="mt-1 border-t border-stone-200 pt-1">
          <form action="/auth/sign-out" method="post">
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="flex min-h-11 w-full items-center px-4 text-left text-sm text-stone-900 hover:bg-stone-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700"
            >
              {t("signOut")}
            </button>
          </form>
        </li>
      </ul>
    </details>
  );
}
