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

// Is the whole element inside the window's height? The 📍 button scrolls the map into view only when it is not: a map that is
// in view already (in the dashboard's two columns it is sticky, spec 0001 AC-28) must not move the page, which would shift the
// list from under the pointer.
export function fullyInView(rect: { top: number; bottom: number }, viewportHeight: number) {
  return rect.top >= 0 && rect.bottom <= viewportHeight;
}
