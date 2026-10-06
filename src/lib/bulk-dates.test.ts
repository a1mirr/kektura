import { describe, expect, it } from "vitest";
import {
  buildBulkItems,
  canApply,
  clickRow,
  extraItemId,
  MAX_BULK_STAMPS,
  placeItemId,
  rangeIds,
  requestOf,
  retiredConflicts,
  selectedItems,
  type BulkItem,
} from "./bulk-dates";

const place = (key: string, stage = 1, retiredOn?: string): BulkItem => ({
  id: placeItemId(key),
  kind: "place",
  placeKey: key,
  stage,
  name: key,
  ...(retiredOn ? { retiredOn } : {}),
});
const extra = (id: number): BulkItem => ({ id: extraItemId(id), kind: "extra", extraId: id, name: `extra ${id}` });

const ITEMS = [place("A"), place("B"), place("C"), place("D"), extra(1), extra(2)];

describe("spec 0016: change dates (logic)", () => {
  describe("buildBulkItems", () => {
    const stages = [
      {
        stage: 1,
        places: [
          { key: "P1", name: "One" },
          { key: "P2", name: "Two" },
          { key: "P3", name: "Three" },
        ],
        retired: [
          { key: "R_AFTER_P2", name: "Old two", afterKey: "P2", retiredOn: "2014-01-01" },
          { key: "R_LOOSE", name: "Old loose", afterKey: null, retiredOn: "2015-01-01" },
        ],
      },
      { stage: 2, places: [{ key: "P4", name: "Four" }], retired: [] },
    ];
    const all = () => true;

    it("AC-15: lists the stamped rows in the page's order: places, a retired stamp after the place it followed, the loose ones last, then the extras", () => {
      const items = buildBulkItems({ stages, isStamped: all, extras: [{ id: 7, name: "Castle" }, { id: 9, name: "Museum" }], isExtraStamped: all });
      expect(items.map((i) => i.id)).toEqual(["p:P1", "p:P2", "p:R_AFTER_P2", "p:P3", "p:R_LOOSE", "p:P4", "e:7", "e:9"]);
      expect(items[2]).toMatchObject({ kind: "place", stage: 1, retiredOn: "2014-01-01" });
      expect(items[0]).not.toHaveProperty("retiredOn");
    });

    it("AC-14: leaves out what is not stamped: it cannot be chosen", () => {
      const items = buildBulkItems({
        stages,
        isStamped: (key) => key === "P2" || key === "P4",
        extras: [{ id: 7, name: "Castle" }, { id: 9, name: "Museum" }],
        isExtraStamped: (id) => id === 9,
      });
      expect(items.map((i) => i.id)).toEqual(["p:P2", "p:P4", "e:9"]);
    });
  });

  describe("rangeIds and clickRow", () => {
    it("AC-15: a range runs from one row to the other in list order, either way round, and across places and extras", () => {
      expect(rangeIds(ITEMS, "p:B", "p:D")).toEqual(["p:B", "p:C", "p:D"]);
      expect(rangeIds(ITEMS, "p:D", "p:B")).toEqual(["p:B", "p:C", "p:D"]);
      expect(rangeIds(ITEMS, "p:C", "e:1")).toEqual(["p:C", "p:D", "e:1"]);
      expect(rangeIds(ITEMS, "p:B", "p:B")).toEqual(["p:B"]);
      expect(rangeIds(ITEMS, "p:B", "p:NOPE")).toEqual([]);
    });

    it("AC-15: a plain click flips one row and makes it the anchor", () => {
      const first = clickRow(ITEMS, new Set(), null, "p:B", false);
      expect([...first.selected]).toEqual(["p:B"]);
      expect(first.anchor).toBe("p:B");
      const second = clickRow(ITEMS, first.selected, first.anchor, "p:B", false);
      expect([...second.selected]).toEqual([]);
    });

    it("AC-15: a shift-click selects the range from the anchor to the row, keeping the rest, and the row becomes the anchor", () => {
      const start = clickRow(ITEMS, new Set(["p:A"]), "p:A", "p:C", false); // A and C chosen
      const ranged = clickRow(ITEMS, start.selected, start.anchor, "e:1", true); // from C to the extra
      expect([...ranged.selected].sort()).toEqual(["e:1", "p:A", "p:C", "p:D"]);
      expect(ranged.anchor).toBe("e:1");
    });

    it("AC-15: a shift-click on a chosen row clears the range; without an anchor it acts as a plain click", () => {
      const all = new Set(ITEMS.map((i) => i.id));
      const cleared = clickRow(ITEMS, all, "p:A", "p:C", true);
      expect([...cleared.selected].sort()).toEqual(["e:1", "e:2", "p:D"]);
      expect([...clickRow(ITEMS, new Set(), null, "p:C", true).selected]).toEqual(["p:C"]);
    });

    it("AC-15: does not change the selection it was given", () => {
      const before = new Set(["p:A"]);
      clickRow(ITEMS, before, "p:A", "p:C", true);
      expect([...before]).toEqual(["p:A"]);
    });
  });

  describe("the request", () => {
    it("AC-16: selectedItems keeps the list's order and drops what the list no longer holds", () => {
      expect(selectedItems(ITEMS, new Set(["e:1", "p:B", "p:GONE"])).map((i) => i.id)).toEqual(["p:B", "e:1"]);
    });

    it("AC-16: requestOf splits the chosen stamps into place keys and extra ids", () => {
      expect(requestOf([place("A"), extra(2), place("C"), extra(1)])).toEqual({ placeKeys: ["A", "C"], extraIds: [2, 1] });
    });

    it("AC-18: retired stamps on or after their retirement day stand in the way of a date, others do not", () => {
      const chosen = [place("A"), place("R1", 1, "2014-06-01"), place("R2", 1, "2020-01-01"), extra(1)];
      expect(retiredConflicts(chosen, "2014-06-01").map((i) => i.name)).toEqual(["R1"]);
      expect(retiredConflicts(chosen, "2014-05-31")).toEqual([]);
      expect(retiredConflicts(chosen, "2021-01-01").map((i) => i.name)).toEqual(["R1", "R2"]);
      expect(retiredConflicts(chosen, "2014-6-1")).toEqual([]); // not a date: no conflict to name
    });

    describe("canApply", () => {
      const now = new Date("2026-10-06T12:00:00Z");
      it.each([
        ["a valid date and a stamp", [place("A")], "2026-09-01", true],
        ["tomorrow, UTC", [place("A")], "2026-10-07", true],
        ["nothing chosen", [], "2026-09-01", false],
        ["an empty date", [place("A")], "", false],
        ["an incomplete date", [place("A")], "2026-09-0", false],
        ["another format", [place("A")], "01/09/2026", false],
        ["a day that does not exist", [place("A")], "2026-02-30", false],
        ["a date before the trail's first year", [place("A")], "1937-12-31", false],
        ["a date after tomorrow", [place("A")], "2026-10-08", false],
        ["a retired stamp that would get a date from its retirement day on", [place("R", 1, "2014-06-01")], "2026-09-01", false],
        ["a retired stamp that would get an earlier date", [place("R", 1, "2014-06-01")], "2014-05-31", true],
      ])("AC-16: %s", (_, chosen, date, expected) => {
        expect(canApply(chosen as BulkItem[], date, now)).toBe(expected);
      });

      it("AC-16: more than the limit is not applied", () => {
        const many = Array.from({ length: MAX_BULK_STAMPS + 1 }, (_, i) => extra(i));
        expect(canApply(many, "2026-09-01", now)).toBe(false);
        expect(canApply(many.slice(1), "2026-09-01", now)).toBe(true);
      });
    });
  });
});
