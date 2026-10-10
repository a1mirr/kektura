"use client";

import { useRef, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { friendButtonClass, type FriendTone } from "./FriendActionButton";

const noSubscription = () => () => {};

export default function FriendConfirm({
  label,
  question,
  cancelLabel,
  tone = "dangerOutline",
  children,
}: {
  label: string;
  question: string;
  cancelLabel: string;
  tone?: FriendTone;
  children: ReactNode;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);

  function close() {
    if (!details.current) return;
    details.current.open = false;
    details.current.querySelector("summary")?.focus();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && details.current?.open) {
      event.stopPropagation();
      close();
    }
  }

  return (
    <details ref={details} onKeyDown={onKeyDown} className="open:basis-full open:w-full">
      <summary className={`${friendButtonClass(tone)} cursor-pointer list-none select-none marker:hidden [&::-webkit-details-marker]:hidden`}>
        {label}
      </summary>
      <div role="group" aria-label={label} className="mt-2 space-y-3 rounded border border-stone-300 bg-stone-50 p-3">
        <p className="text-sm text-stone-800 [overflow-wrap:anywhere]">{question}</p>
        <div className="flex flex-wrap gap-2">
          {children}
          {hydrated && (
            <button type="button" onClick={close} className={friendButtonClass("neutral")}>
              {cancelLabel}
            </button>
          )}
        </div>
      </div>
    </details>
  );
}
