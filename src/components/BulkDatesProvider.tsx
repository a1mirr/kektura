"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { clickRow, selectedItems, type BulkItem } from "@/lib/bulk-dates";

// The state of "Set dates" (spec 0016 AC-14 to AC-21) shared by the floating button, the rows' checkboxes, the stage headers and
// the bar: whether the mode is on, which rows are chosen, and the answer to the last save. The page hands over the rows that can be
// chosen, stamped or not, in the order it shows them (`items`); a chosen row that is no longer among them is no longer chosen.
export type BulkApi = {
  items: readonly BulkItem[];
  max: string; // the latest date the server accepts (tomorrow, UTC)
  active: boolean;
  chosen: BulkItem[]; // the chosen rows, in the page's order
  isSelected: (id: string) => boolean;
  has: (id: string) => boolean; // the row can be chosen
  enter: () => void;
  exit: () => void;
  toggle: (id: string, shift: boolean) => void;
  selectMany: (ids: string[]) => void;
  selectAll: () => void;
  clear: () => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  saved: { count: number } | null; // the last save that went through
  finish: (count: number) => void; // a save went through: leave the mode and say how many dates were set
};

const Context = createContext<BulkApi | null>(null);

// Null outside the dashboard's provider: the controls then are not offered.
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
    if (busy) return; // a save is on its way: leaving now would hide its answer
    setActive(false);
    reset();
  }, [busy, reset]);

  const enter = useCallback(() => {
    setActive(true);
    setSaved(null);
    reset();
  }, [reset]);

  // Escape leaves the mode (spec 0016 AC-14), unless something else took it first: a row's note closes on Escape and says so with
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

  // The wrapper of the list's blocks. On a phone the bar, or the button when the mode is off, is fixed to the bottom of the screen:
  // the last rows need room above it.
  return (
    <Context.Provider value={api}>
      <div className={`space-y-8 ${active ? "max-lg:pb-44" : "max-lg:pb-20"}`}>{children}</div>
    </Context.Provider>
  );
}
