export const FOCUS_EVENT = "kektura:focus";

export type FocusDetail = {
  kind: "place" | "extra";
  key: string;
  name: string;
  lat: number;
  lng: number;
};

export function focusOnMap(detail: FocusDetail) {
  window.dispatchEvent(new CustomEvent<FocusDetail>(FOCUS_EVENT, { detail }));
}

type Edges = { top: number; bottom: number };

// The dashboard's sticky map block has its own scroll, and a map scrolled half out of it is not in view. The 📍
// button scrolls the map into view only when it is not: a map that is in view already must not move the page, which
// would shift the list from under the pointer.
export function fullyInView(rect: Edges, viewportHeight: number, container?: Edges | null) {
  const top = Math.max(0, container?.top ?? 0);
  const bottom = Math.min(viewportHeight, container?.bottom ?? viewportHeight);
  return rect.top >= top && rect.bottom <= bottom;
}

export function centeredScrollTop(rect: Edges, container: Edges, scrollTop: number) {
  const offset = rect.top - container.top - (container.bottom - container.top - (rect.bottom - rect.top)) / 2;
  return Math.max(0, scrollTop + offset);
}
