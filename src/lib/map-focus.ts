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
