"use client";

import { useEffect, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useActionGroup } from "./FriendActionGroup";

// The look of every button on the Friends page (spec 0024 AC-17, AC-20): at least 44 x 44 px, a darker shade under
// the pointer and while pressed, a ring for the keyboard. `not-disabled:` keeps it off while the button is busy (and,
// unlike `enabled:`, also matches the <summary> of a confirmation).
const base =
  "relative inline-flex min-h-11 min-w-11 items-center justify-center rounded px-4 py-2 text-sm font-medium transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 " +
  "not-disabled:active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60";

const tones = {
  neutral: "bg-stone-200 text-stone-900 not-disabled:hover:bg-stone-300 not-disabled:active:bg-stone-400",
  primary: "bg-blue-700 text-white not-disabled:hover:bg-blue-800 not-disabled:active:bg-blue-900",
  approve: "bg-green-700 text-white not-disabled:hover:bg-green-800 not-disabled:active:bg-green-900",
  danger: "bg-red-700 text-white not-disabled:hover:bg-red-800 not-disabled:active:bg-red-900",
  dangerOutline: "border border-red-700 text-red-700 not-disabled:hover:bg-red-50 not-disabled:active:bg-red-100",
} as const;

export type FriendTone = keyof typeof tones;

export const friendButtonClass = (tone: FriendTone) => `${base} ${tones[tone]}`;

// A submit button for a form that posts to a server action which ends in a redirect. While the request runs it
// is disabled and shows a spinner in place of its label (which stays in the layout and the accessibility tree, transparent, so the button does not
// change size), and the other buttons of its row are disabled. It is a plain submit button, so it works before
// hydration and without JavaScript.
export default function FriendActionButton({ children, tone = "neutral" }: { children: ReactNode; tone?: FriendTone }) {
  const { pending } = useFormStatus();
  const group = useActionGroup();

  useEffect(() => {
    if (!pending || !group) return;
    group.begin();
    return group.end;
  }, [pending, group?.begin, group?.end]); // eslint-disable-line react-hooks/exhaustive-deps

  const disabled = pending || (group?.busy ?? false);
  return (
    <button type="submit" disabled={disabled} aria-busy={pending} className={friendButtonClass(tone)}>
      <span className={pending ? "opacity-0" : undefined}>{children}</span>
      {pending && (
        <span aria-hidden="true" className="absolute inset-0 grid place-items-center">
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </span>
      )}
    </button>
  );
}
