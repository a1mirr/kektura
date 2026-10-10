"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { clickRow, selectedItems, type BulkItem } from "@/lib/bulk-dates";

export type BulkApi = {
  items: readonly BulkItem[];
  max: string; // the latest date the server accepts (tomorrow, UTC)
  active: boolean;
  chosen: BulkItem[];
  isSelected: (id: string) => boolean;
  has: (id: string) => boolean;
  enter: () => void;
  exit: () => void;
  toggle: (id: string, shift: boolean) => void;
  selectMany: (ids: string[]) => void;
  selectAll: () => void;
  clear: () => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  saved: { count: number } | null;
  finish: (count: number) => void;
};

const Context = createContext<BulkApi | null>(null);

export const useBulk = () => useContext(Context);

export default function BulkDatesProvider({ items, max, children }: { items: readonly BulkItem[]; max: string; children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ count: number } | null>(null);

  const ids = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  const chosen = useMemo(() => selectedItems(items, selected), [items, selected]);
  const chosenIds = useMemo(() => new Set(chosen.map((i) => i.id)), [chosen]);

  const reset = useCallback(() => {
    setSelected(new Set());
    setAnchor(null);
  }, []);

  const exit = useCallback(() => {
    if (busy) return;
    setActive(false);
    reset();
  }, [busy, reset]);

  const enter = useCallback(() => {
    setActive(true);
    setSaved(null);
    reset();
  }, [reset]);

  // Escape leaves the mode, unless something else took it first: a row's note closes on Escape and says so with
  // preventDefault, and closing it must not cost the choice.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, exit]);

  const api: BulkApi = {
    items,
    max,
    active,
    chosen,
    isSelected: (id) => chosenIds.has(id),
    has: (id) => ids.has(id),
    enter,
    exit,
    toggle: (id, shift) => {
      const next = clickRow(items, chosenIds, anchor, id, shift);
      setSelected(next.selected);
      setAnchor(next.anchor);
    },
    selectMany: (more) => setSelected(new Set([...chosenIds, ...more.filter((id) => ids.has(id))])),
    selectAll: () => setSelected(new Set(ids)),
    clear: reset,
    busy,
    setBusy,
    saved,
    finish: (count) => {
      setActive(false);
      reset();
      setSaved({ count });
    },
  };

  return (
    <Context.Provider value={api}>
      <div className={`space-y-8${active ? " max-lg:pb-44" : ""}`}>{children}</div>
    </Context.Provider>
  );
}
