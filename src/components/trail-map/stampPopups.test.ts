// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/[locale]/dashboard/actions", () => ({ setExtraStamped: vi.fn(), setPlacesStamped: vi.fn() }));

import { attachStampPopups } from "./stampPopups";

function setup(point: { note?: string; movedNote?: string; code?: string | null }) {
  let click: (e: unknown) => void = () => {};
  let content: HTMLElement | null = null;
  class Popup {
    setLngLat() { return this; }
    setText() { return this; }
    setDOMContent(node: HTMLElement) { content = node; return this; }
    addTo() { return this; }
    remove() {}
  }
  const map = {
    on: (event: string, _layers: string[], handler: (e: unknown) => void) => {
      if (event === "click") click = handler;
    },
    getCanvas: () => ({ style: {} }),
  };
  const latest = { current: { points: [{ placeKey: "P1", name: "Vércverés", lat: 47, lng: 19, km: 12.34, stamped: false, code: "OKTPH_103", ...point }], extras: [], doneRanges: [] } };
  const ctx = {
    current: {
      t: (key: string, values?: { km?: string }) => (values?.km ? `${values.km} km from the start` : key),
      reportHref: (code: string) => `/en/feedback?stamp=${code}`,
    },
  };
  attachStampPopups(map as never, { Popup } as never, latest as never, ctx as never);
  click({ features: [{ geometry: { type: "Point", coordinates: [19, 47] }, properties: { kind: "place", key: "P1", name: "Vércverés" } }] });
  return content as HTMLElement | null;
}

describe("spec 0003: the popup of a stamp on the map", () => {
  it("AC-22: a new stamp's popup says when it is required from and, if it applies, that the user was not missing it", () => {
    const note = "Stamp required from November 21, 2014 · Not required for your walk";
    const popup = setup({ note });
    expect(popup!.textContent).toContain("12.3 km from the start");
    expect(popup!.textContent).toContain(note);
  });

  it("AC-22: a stamp that was always required has no such line", () => {
    const popup = setup({});
    expect(popup!.textContent).toContain("12.3 km from the start");
    expect(popup!.textContent).not.toContain("required");
    expect(popup!.textContent).not.toContain(" · ");
  });

  it("AC-26: the popup of a stamp that moved carries the note, as a paragraph of its own", () => {
    const popup = setup({ movedNote: "Moved on September 30, 2026. Where it is now: by the lookout" });
    expect(popup!.querySelector("[data-moved-note]")?.textContent).toBe("Moved on September 30, 2026. Where it is now: by the lookout");
  });

  it("AC-26: the popup of a stamp that did not move has no such note", () => {
    expect(setup({})!.querySelector("[data-moved-note]")).toBeNull();
  });

  it("AC-27: every stamp's popup has the report link, carrying only the stamp's code", () => {
    const a = setup({})!.querySelector<HTMLAnchorElement>("a[data-report-link]")!;
    expect(a.textContent).toBe("reportLocation");
    expect(a.getAttribute("href")).toBe("/en/feedback?stamp=OKTPH_103");
  });

  it("AC-27: a row without a code has no link to report", () => {
    expect(setup({ code: null })!.querySelector("a")).toBeNull();
  });
});
