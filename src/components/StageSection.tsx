"use client";

import { useCallback, useEffect, useState } from "react";
import { STAGE_EVENT, type StageEventDetail } from "@/lib/stage-events";

const storageKey = (stage: number) => `kektura:stage:${stage}`;

export default function StageSection({
  stage,
  title,
  route,
  kmText,
  done,
  total,
  mark,
  actions,
  children,
}: {
  stage: number;
  title: string;
  route: string;
  kmText: string;
  done: number;
  total: number;
  mark?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Collapsed on first render (matches the server HTML); the remembered state is applied after mount.
  const [open, setOpen] = useState(false);

  const apply = useCallback(
    (next: boolean) => {
      setOpen(next);
      try {
        localStorage.setItem(storageKey(stage), next ? "1" : "0");
      } catch {
      }
    },
    [stage],
  );

  useEffect(() => {
    // Deferred so the state update isn't synchronous inside the effect.
    const id = requestAnimationFrame(() => {
      try {
        if (localStorage.getItem(storageKey(stage)) === "1") setOpen(true);
      } catch {
      }
    });
    return () => cancelAnimationFrame(id);
  }, [stage]);

  useEffect(() => {
    const onEvent = (e: Event) => {
      const d = (e as CustomEvent<StageEventDetail>).detail;
      if (d.stage === "all" || d.stage === stage) apply(d.open);
    };
    window.addEventListener(STAGE_EVENT, onEvent);
    return () => window.removeEventListener(STAGE_EVENT, onEvent);
  }, [stage, apply]);

  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <section id={`stage-${stage}`} className="scroll-mt-24 rounded-lg bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => apply(!open)}
          className="flex min-w-0 flex-1 basis-48 items-center gap-3 text-left"
        >
          <span
            aria-hidden
            className={`text-stone-400 transition-transform ${open ? "rotate-90" : ""}`}
          >
            ▸
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-semibold">{title}</span>
            <span className="ml-2 text-sm text-stone-500 [overflow-wrap:anywhere]">
              {route} · {kmText}
            </span>
            <span className="mt-1 block h-1.5 w-full max-w-48 overflow-hidden rounded bg-stone-100">
              <span className="block h-full bg-blue-600" style={{ width: `${pct}%` }} />
            </span>
          </span>
          <span className="shrink-0 text-sm tabular-nums text-stone-600">
            {done}/{total}
            {mark && <span className="ml-1 text-xs text-stone-500">{mark}</span>}
          </span>
        </button>
        {actions}
      </div>
      {/* Always rendered (just hidden) so map clicks can find and scroll to rows. */}
      <ul className={open ? "divide-y border-t border-stone-100" : "hidden"}>{children}</ul>
    </section>
  );
}
