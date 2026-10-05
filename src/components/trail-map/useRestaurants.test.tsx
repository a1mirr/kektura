// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRestaurants } from "./useRestaurants";
import type { MapHandleRef } from "./types";

const mapRef = { current: { map: null, ready: false, route: null } } as MapHandleRef;
const items = [{ name: "Étterem", city: "Eger", url: "https://example.test/x", lat: 47, lng: 19, distKm: 1 }];

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(items))));
});
afterEach(() => vi.unstubAllGlobals());

describe("spec 0003: the restaurants of the trail map", () => {
  it("AC-21: switching the flag off while the page is open empties the layer and the checkbox's count", async () => {
    const setData = vi.fn();
    const ref = { current: { map: { getSource: () => ({ setData }) }, ready: true, route: null } } as unknown as MapHandleRef;
    const { result, rerender } = renderHook(({ enabled }) => useRestaurants(ref, enabled), { initialProps: { enabled: true } });
    await waitFor(() => expect(result.current.restaurants).toHaveLength(1));
    expect(setData).toHaveBeenLastCalledWith(expect.objectContaining({ features: [expect.anything()] }));

    rerender({ enabled: false });
    expect(result.current.restaurants).toEqual([]);
    expect(result.current.restaurantsRef.current).toEqual([]);
    expect(setData).toHaveBeenLastCalledWith(expect.objectContaining({ features: [] }));
  });

  it("AC-14: with the flag on the restaurants are fetched once and handed to the map's seed", async () => {
    const { result } = renderHook(() => useRestaurants(mapRef, true));
    await waitFor(() => expect(result.current.restaurants).toHaveLength(1));
    expect(result.current.restaurantsRef.current).toEqual(items);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/data/restaurants.json");
  });

  it("AC-21: with the flag off nothing is fetched and the layer stays empty", async () => {
    const { result } = renderHook(() => useRestaurants(mapRef, false));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.restaurants).toEqual([]);
    expect(result.current.restaurantsRef.current).toEqual([]);
  });

  it("AC-14: a failed fetch leaves the layer unavailable without an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    const { result } = renderHook(() => useRestaurants(mapRef, true));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.restaurants).toEqual([]);
  });
});
