"use client";

import { useShowRetired } from "@/lib/retired-toggle";

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
