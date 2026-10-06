// List -> map navigation: rows dispatch this event, the map listens and flies to the point.
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

// Is the whole element in view? In the window (its height) and, when it sits in a box that scrolls inside itself, inside that box
// too: the dashboard's sticky map block has its own scroll (spec 0001 AC-28), and a map scrolled half out of it is not in view.
// The 📍 button scrolls the map into view only when it is not: a map that is in view already must not move the page, which
// would shift the list from under the pointer.
export function fullyInView(rect: Edges, viewportHeight: number, container?: Edges | null) {
  const top = Math.max(0, container?.top ?? 0);
  const bottom = Math.min(viewportHeight, container?.bottom ?? viewportHeight);
  return rect.top >= top && rect.bottom <= bottom;
}

// Where a scroll box has to be scrolled (its new scrollTop) to show an element in its middle. Rects are viewport rects.
export function centeredScrollTop(rect: Edges, container: Edges, scrollTop: number) {
  const offset = rect.top - container.top - (container.bottom - container.top - (rect.bottom - rect.top)) / 2;
  return Math.max(0, scrollTop + offset);
}
