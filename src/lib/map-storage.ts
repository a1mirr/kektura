export const STORAGE_KEY_EXTRAS = "kektura:showExtras";
export const STORAGE_KEY_RESTAURANTS = "kektura:showRestaurants";
export const STORAGE_KEY_DONE = "kektura:showDone";
export const STORAGE_KEY_STAMPS = "kektura:showStamps";

export function readStored(key: string, fallback = false) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}

export function store(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? "1" : "0");
  } catch {
    // storage unavailable: the toggle just isn't remembered
  }
}
