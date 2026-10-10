"use client";

import { useEffect, useRef, type ReactNode } from "react";

// It scrolls into view, since on a phone the top may be above what is on screen after an action at the bottom of a
// long list.
export default function FlashMessage({ kind, children }: { kind: "ok" | "error"; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // Without a dependency list on purpose: the page re-renders this with every answer, also with the same text twice.
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: "nearest" });
  });
  return (
    <div
      ref={ref}
      role={kind === "ok" ? "status" : "alert"}
      aria-live={kind === "ok" ? "polite" : undefined}
      className={`rounded-lg p-4 ${kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}
    >
      {children}
    </div>
  );
}
