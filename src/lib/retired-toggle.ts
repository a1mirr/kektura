"use client";

import { useSyncExternalStore } from "react";

const KEY = "kektura:showRetired";
const EVENT = "kektura:retired-toggle";

let fallback: boolean | null = null; // what is used once localStorage has refused a write

export function readShowRetired(): boolean {
  if (fallback !== null) return fallback;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setShowRetired(show: boolean) {
  try {
    localStorage.setItem(KEY, show ? "1" : "0");
    fallback = null;
  } catch {
    fallback = show;
  }
  window.dispatchEvent(new Event(EVENT));
}

const subscribe = (notify: () => void) => {
  window.addEventListener(EVENT, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(EVENT, notify);
    window.removeEventListener("storage", notify);
  };
};

// False on the server and during hydration (matching the server's HTML), then what the browser remembers.
export const useShowRetired = () => useSyncExternalStore(subscribe, readShowRetired, () => false);
