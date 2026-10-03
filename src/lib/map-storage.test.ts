// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readStored,
  store,
  STORAGE_KEY_DONE,
  STORAGE_KEY_EXTRAS,
  STORAGE_KEY_RESTAURANTS,
  STORAGE_KEY_STAMPS,
} from "./map-storage";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("spec 0003: map storage helpers (AC-10)", () => {
  it("AC-17: nothing stored gives the fallback (false unless told otherwise)", () => {
    expect(readStored(STORAGE_KEY_EXTRAS)).toBe(false);
    expect(readStored(STORAGE_KEY_DONE, true)).toBe(true);
  });

  it("AC-17: a stored choice wins over the fallback and round-trips", () => {
    store(STORAGE_KEY_DONE, false);
    expect(localStorage.getItem(STORAGE_KEY_DONE)).toBe("0");
    expect(readStored(STORAGE_KEY_DONE, true)).toBe(false);
    store(STORAGE_KEY_DONE, true);
    expect(localStorage.getItem(STORAGE_KEY_DONE)).toBe("1");
    expect(readStored(STORAGE_KEY_DONE)).toBe(true);
  });

  it("AC-17: unavailable storage neither throws nor remembers", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => store(STORAGE_KEY_EXTRAS, true)).not.toThrow();
    expect(readStored(STORAGE_KEY_EXTRAS, true)).toBe(true);
    expect(readStored(STORAGE_KEY_EXTRAS)).toBe(false);
  });

  it("AC-17: the storage keys keep their old names, so existing choices survive the refactor", () => {
    expect({
      extras: STORAGE_KEY_EXTRAS,
      restaurants: STORAGE_KEY_RESTAURANTS,
      done: STORAGE_KEY_DONE,
      stamps: STORAGE_KEY_STAMPS,
    }).toEqual({
      extras: "kektura:showExtras",
      restaurants: "kektura:showRestaurants",
      done: "kektura:showDone",
      stamps: "kektura:showStamps",
    });
  });
});
