// Built with DOM nodes and never innerHTML, so names in the data can't inject markup.
import { RESTAURANT } from "./map-layers";

export type MenuAction = {
  label: string;
  run: (button: HTMLButtonElement, showError: (message: string) => void) => void;
};

export type MenuExtras = {
  note?: string | null;
  // Only an https: or same-site path becomes a link, so nothing in the data can make a javascript: one.
  link?: { label: string; href: string } | null;
};

export function buildMenu(title: string, subtitle: string | null, actions: MenuAction[], extras: MenuExtras = {}) {
  const box = document.createElement("div");
  box.style.minWidth = "200px";
  const heading = document.createElement("strong");
  heading.textContent = title;
  box.append(heading);
  if (subtitle) {
    const sub = document.createElement("div");
    sub.textContent = subtitle;
    sub.style.cssText = "font-size:12px;color:#78716c;margin-bottom:4px";
    box.append(sub);
  }
  if (extras.note) {
    const note = document.createElement("div");
    note.dataset.movedNote = "";
    note.textContent = extras.note;
    note.style.cssText = "font-size:12px;color:#78350f;background:#fffbeb;border-radius:4px;padding:6px;margin:4px 0";
    box.append(note);
  }
  const error = document.createElement("div");
  error.setAttribute("role", "alert");
  error.style.cssText = "font-size:12px;color:#dc2626;padding-top:4px";
  error.hidden = true;
  const showError = (message: string) => {
    error.textContent = message;
    error.hidden = false;
  };
  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.style.cssText =
      "display:block;width:100%;text-align:left;padding:6px 0;background:none;border:0;border-top:1px solid #e7e5e4;cursor:pointer;color:#1d4ed8;font:inherit";
    button.addEventListener("click", () => {
      error.hidden = true;
      action.run(button, showError);
    });
    box.append(button);
  }
  if (extras.link && /^\/(?![/\\])|^https:\/\//.test(extras.link.href)) {
    const link = document.createElement("a");
    link.href = extras.link.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = extras.link.label;
    link.dataset.reportLink = "";
    link.style.cssText =
      "display:flex;align-items:center;min-height:44px;min-width:44px;border-top:1px solid #e7e5e4;color:#1d4ed8;text-decoration:underline";
    box.append(link);
  }
  box.append(error);
  return box;
}

// Only https: URLs become links, so a javascript: URL in the data does nothing.
export function buildRestaurantPopup(restaurant: {
  name: string;
  city: string;
  url: string;
  distance: string;
  linkLabel: string;
}) {
  const box = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = restaurant.name + " (" + restaurant.city + ")";
  const dist = document.createElement("div");
  dist.textContent = restaurant.distance;
  const link = document.createElement("a");
  if (restaurant.url.startsWith("https://")) link.href = restaurant.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = restaurant.linkLabel;
  link.style.color = RESTAURANT;
  box.append(title, dist, link);
  return box;
}
