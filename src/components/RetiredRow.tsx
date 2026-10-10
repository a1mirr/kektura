"use client";

import { useShowRetired } from "@/lib/retired-toggle";

// A retired stamp's row in a stage list (spec 0001 AC-23, AC-24, AC-26): listed when the user's own stamps say so (`listed`, decided
// on the server), or whenever "Show retired stamps" is on. Muted, so it reads as a record, not a requirement.
export default function RetiredRow({ id, listed, children }: { id: string; listed: boolean; children: React.ReactNode }) {
  const show = useShowRetired();
  const hidden = !listed && !show;
  return (
    <li
      id={id}
      hidden={hidden}
      data-retired
      className={`scroll-mt-24 lg:scroll-mt-44 flex-wrap items-start justify-between gap-x-2 gap-y-1 bg-stone-50 px-4 py-3 text-stone-600 ${hidden ? "hidden" : "flex"}`}
    >
      {children}
    </li>
  );
}
