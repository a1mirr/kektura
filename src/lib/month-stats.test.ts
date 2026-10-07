import { createTranslator } from "use-intl/core";
import type { Locale } from "next-intl";
import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";
import { messageFiles } from "../../tests/message-files";
import { monthLines, monthlyProgress, monthsBetween, stageList, type MonthStats, type MonthWords } from "./month-stats";
import {
  buildPlaces,
  buildRetired,
  buildStages,
  progressSummary,
  stampedPlaceKeys,
  waivedPlaceKeys,
  walkedRanges,
  type Checkpoint,
  type StageMeta,
} from "./progress";

let nextId = 1;
// One checkpoint row; variants of a place share `key`.
function cp(key: string, km: number, over: Partial<Checkpoint> = {}): Checkpoint {
  const id = nextId++;
  return {
    id,
    seq: id,
    stage: 1,
    stage_seq: 1,
    code: `${key}_${id}`,
    place_key: key,
    name: key,
    description: null,
    lat: 47,
    lng: 16,
    km_from_start: km,
    required_from: null,
    retired_on: null,
    replaced_by: null,
    after_place_key: null,
    position_approximate: false,
    moved_on: null,
    ...over,
  };
}

// The stamps of a walk: `{ A: "2026-06-03" }` is a stamp on the (first) row of place A.
function stampsOf(rows: Checkpoint[], dates: Record<string, string>) {
  return Object.entries(dates).map(([key, stamped_on]) => ({
    checkpoint_id: rows.find((r) => r.place_key === key)!.id,
    stamped_on,
  }));
}

// A, B, C, D, 10 km apart, in stages 1 and 2 (A-B-C stage 1; D stage 2).
const stageMeta: StageMeta[] = [
  { stage: 1, start: "A", end: "C", km: 20 },
  { stage: 2, start: "C", end: "D", km: 10 },
];
function walk(dates: Record<string, string>, extras: { id: number; km: number }[] = [], extraStamps: { extra_id: number; stamped_on: string }[] = []) {
  const rows = [cp("A", 0), cp("B", 10), cp("C", 20), cp("D", 30, { stage: 2 })];
  const places = buildPlaces(rows);
  const stamps = stampsOf(rows, dates);
  const stages = buildStages(places, stageMeta);
  const months = monthlyProgress({
    places,
    stamps,
    stages,
    extras: extras.map((e) => ({ id: e.id, km_from_start: e.km })),
    extraStamps,
  });
  return { rows, places, stamps, stages, months };
}
const monthsOf = (months: MonthStats[]) => months.map((m) => m.month);
const kmOf = (months: MonthStats[]) => Object.fromEntries(months.map((m) => [m.month, m.km]));

describe("spec 0037: the months of a walk", () => {
  it("AC-4: every month from the first to the last stamp, the empty ones too, oldest first", () => {
    const { months } = walk({ A: "2026-01-15", B: "2026-04-02" });
    expect(monthsOf(months)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
    expect(months.map((m) => m.stamps)).toEqual([1, 0, 0, 1]);
    expect(months[1]).toEqual({ month: "2026-02", stamps: 0, extraStamps: 0, stages: [], km: 0 });
  });

  it("AC-4: the span runs across a year, and extra stamps stretch it as well", () => {
    expect(monthsBetween("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthsBetween("2026-03", "2026-03")).toEqual(["2026-03"]);
    const { months } = walk({ B: "2026-03-10" }, [{ id: 7, km: 5 }], [{ extra_id: 7, stamped_on: "2026-01-02" }]);
    expect(monthsOf(months)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("AC-4: a day belongs to the calendar month it is written in: no time zone moves it", () => {
    const { months } = walk({ A: "2026-06-30", B: "2026-07-01" });
    expect(months.map((m) => [m.month, m.stamps])).toEqual([
      ["2026-06", 1],
      ["2026-07", 1],
    ]);
  });

  it("AC-4: no stamps, no months", () => {
    expect(walk({}).months).toEqual([]);
  });

  it("AC-5: a place is one stamp in the month of its earliest stamp, not a row per variant", () => {
    const rows = [cp("A", 0), cp("K", 5), cp("K", 6), cp("B", 9)];
    const [, k1, k2] = rows;
    const places = buildPlaces(rows);
    const months = monthlyProgress({
      places,
      stamps: [
        { checkpoint_id: k2.id, stamped_on: "2026-09-03" },
        { checkpoint_id: k1.id, stamped_on: "2026-08-20" },
        { checkpoint_id: rows[0].id, stamped_on: "2026-09-01" },
        { checkpoint_id: rows[3].id, stamped_on: "2025-12-31" },
        { checkpoint_id: 999_999, stamped_on: "2026-01-01" }, // unknown checkpoint: ignored
      ],
      stages: buildStages(places, []),
      extras: [],
      extraStamps: [],
    });
    expect(months.filter((m) => m.stamps > 0).map((m) => [m.month, m.stamps])).toEqual([
      ["2025-12", 1],
      ["2026-08", 1],
      ["2026-09", 1],
    ]);
    expect(monthsOf(months)).toHaveLength(10); // Dec 2025 to Sep 2026, the empty months among them
  });

  it("AC-5: a stamp on a retired row is no month's stamp and does not stretch the span", () => {
    const rows = [cp("A", 0), cp("B", 10), cp("R", 10, { stage_seq: null, retired_on: "2014-11-21", after_place_key: "A" })];
    expect(buildRetired(rows)).toHaveLength(1);
    const places = buildPlaces(rows);
    const months = monthlyProgress({
      places,
      stamps: [
        { checkpoint_id: rows[0].id, stamped_on: "2014-06-01" },
        { checkpoint_id: rows[2].id, stamped_on: "2013-01-02" },
      ],
      stages: buildStages(places, []),
      extras: [],
      extraStamps: [],
    });
    expect(months).toEqual([{ month: "2014-06", stamps: 1, extraStamps: 0, stages: [1], km: 0 }]);
  });

  it("AC-6: a month's stages are the stages of the places first stamped in it, in order; a stage that spans months is in each", () => {
    const { months } = walk({ D: "2026-02-01", A: "2026-02-03", B: "2026-03-01", C: "2026-03-09" });
    expect(months.map((m) => [m.month, m.stages])).toEqual([
      ["2026-02", [1, 2]],
      ["2026-03", [1]],
    ]);
  });

  it("AC-6: extra stamps are counted apart, and their own stage is listed too", () => {
    const { months } = walk(
      { A: "2026-02-03" },
      [
        { id: 1, km: 25 }, // between C (20) and D (30): the end of stage 2 is D, so it lies in stage 2
        { id: 2, km: 5 }, // stage 1
        { id: 3, km: 500 }, // beyond the trail: no stage
      ],
      [
        { extra_id: 1, stamped_on: "2026-02-20" },
        { extra_id: 2, stamped_on: "2026-03-02" },
        { extra_id: 3, stamped_on: "2026-03-03" },
        { extra_id: 404, stamped_on: "2026-03-04" }, // an extra stamp that is not in the list: counted, no stage
      ],
    );
    expect(months.map((m) => [m.month, m.stamps, m.extraStamps, m.stages])).toEqual([
      ["2026-02", 1, 1, [1, 2]],
      ["2026-03", 0, 3, [1]],
    ]);
  });
});

describe("spec 0037: the kilometres of a month", () => {
  it("AC-7: a stretch belongs to the month of the later of its two stamps", () => {
    const { months } = walk({ A: "2026-06-10", B: "2026-07-01", C: "2026-08-20" });
    expect(kmOf(months)).toEqual({ "2026-06": 0, "2026-07": 10, "2026-08": 10 });
  });

  it("AC-7: a stamp placed next to one of an earlier month adds the whole stretch to this month, whatever the order of the stamps", () => {
    // A in June and C in August; B between them is stamped last, in September: A-B and B-C are both walked then.
    expect(kmOf(walk({ A: "2026-06-10", C: "2026-08-20", B: "2026-09-02" }).months)).toEqual({
      "2026-06": 0,
      "2026-07": 0,
      "2026-08": 0,
      "2026-09": 20,
    });
    // Had B been stamped in July, A-B would count in July and B-C in August.
    expect(kmOf(walk({ A: "2026-06-10", C: "2026-08-20", B: "2026-07-02" }).months)).toEqual({ "2026-06": 0, "2026-07": 10, "2026-08": 10 });
  });

  it("AC-7: a stretch needs both neighbours: a lone stamp, or stamps that do not touch, have no km", () => {
    expect(walk({ A: "2026-06-10" }).months[0].km).toBe(0);
    expect(walk({ A: "2026-06-10", C: "2026-06-12" }).months[0].km).toBe(0);
  });

  it("AC-7: the months add up to the dashboard's walked km, however the stamps came", () => {
    const rows = [cp("A", 0), cp("B", 8.1), cp("C", 13.0), cp("D", 28.7), cp("E", 31.9), cp("F", 40.3)];
    const places = buildPlaces(rows);
    const dates: Record<string, string> = { A: "2025-12-31", B: "2026-01-01", C: "2026-03-05", D: "2026-02-10", E: "2026-02-11", F: "2026-05-30" };
    const stamps = stampsOf(rows, dates);
    const months = monthlyProgress({ places, stamps, stages: buildStages(places, []), extras: [], extraStamps: [] });
    const stamped = stampedPlaceKeys(places, stamps);
    const done = progressSummary(places, walkedRanges(places, stamped, waivedPlaceKeys(places, stamped))).doneKm;
    const sum = months.reduce((total, m) => total + m.km, 0);
    expect(Math.round(sum * 10) / 10).toBe(done);
    expect(done).toBe(40.3);
    // unrounded months: rounding each one first would give 40.2 or 40.4
    expect(months.map((m) => m.km).some((km) => Math.round(km * 10) / 10 !== km)).toBe(true);
  });

  it("AC-7: a place the user was not missing is skipped: the stretch runs across it, dated by the later of its two stamped neighbours", () => {
    // N (15 km) became required on 2025-05-08; B and C were stamped before that day, so N is waived.
    const rows = [cp("A", 0), cp("B", 10), cp("N", 15, { required_from: "2025-05-08" }), cp("C", 20)];
    const places = buildPlaces(rows);
    const stamps = stampsOf(rows, { A: "2025-03-01", B: "2025-04-01", C: "2025-04-20" });
    const stamped = stampedPlaceKeys(places, stamps);
    expect([...waivedPlaceKeys(places, stamped)]).toEqual(["N"]);
    const months = monthlyProgress({ places, stamps, stages: buildStages(places, []), extras: [], extraStamps: [] });
    expect(kmOf(months)).toEqual({ "2025-03": 0, "2025-04": 20 }); // B-C is one stretch of 10 km, dated April; A-B too
    const done = progressSummary(places, walkedRanges(places, stamped, waivedPlaceKeys(places, stamped))).doneKm;
    expect(done).toBe(20);
  });

  it("AC-7: a required stamp that is missing blocks its stretches, as on the dashboard", () => {
    const rows = [cp("A", 0), cp("B", 10), cp("N", 15, { required_from: "2025-05-08" }), cp("C", 20)];
    const places = buildPlaces(rows);
    const stamps = stampsOf(rows, { A: "2025-06-01", B: "2025-06-02", C: "2025-06-03" }); // walked after N was required
    expect(kmOf(monthlyProgress({ places, stamps, stages: buildStages(places, []), extras: [], extraStamps: [] }))).toEqual({ "2025-06": 10 });
  });
});

describe("spec 0037: changing a date, removing a stamp", () => {
  it("AC-8: a changed date moves the stamp and the km that depend on it to the new month", () => {
    const before = walk({ A: "2026-06-10", B: "2026-06-20" });
    expect(before.months.map((m) => [m.month, m.stamps, m.km])).toEqual([["2026-06", 2, 10]]);
    const after = walk({ A: "2026-06-10", B: "2026-08-02" });
    expect(after.months.map((m) => [m.month, m.stamps, m.km])).toEqual([
      ["2026-06", 1, 0],
      ["2026-07", 0, 0],
      ["2026-08", 1, 10],
    ]);
  });

  it("AC-8: a removed stamp takes the stretches it made walked out of the month they were in", () => {
    const { months } = walk({ A: "2026-06-10", C: "2026-07-10" }); // B was stamped in July and is removed again
    expect(months.reduce((sum, m) => sum + m.km, 0)).toBe(0);
    expect(walk({ A: "2026-06-10", B: "2026-06-11", C: "2026-07-10" }).months.map((m) => m.km)).toEqual([10, 10]);
  });
});

describe("spec 0037: the words of a month", () => {
  it("AC-11: runs of four or more stages are written first-last, shorter ones are listed", () => {
    expect(stageList([3, 4, 5])).toBe("3, 4, 5");
    expect(stageList([3, 4, 5, 6, 7])).toBe("3-7");
    expect(stageList([1, 2, 5, 6, 7, 8, 12, 14])).toBe("1, 2, 5-8, 12, 14");
    expect(stageList([7])).toBe("7");
    expect(stageList([5, 3, 4, 4])).toBe("3, 4, 5");
    expect(stageList([])).toBe("");
  });

  const words: MonthWords = {
    stamps: (n) => `${n} stamps`,
    extraStamps: (n) => `${n} extra`,
    none: "none",
    km: (km) => `${km} km`,
    stage: (l) => `Stage ${l}`,
    stages: (l) => `Stages ${l}`,
  };
  const month = (over: Partial<MonthStats>): MonthStats => ({ month: "2026-06", stamps: 0, extraStamps: 0, stages: [], km: 0, ...over });

  it("AC-11: a month names its stamps, its km rounded to 0.1 and its stages, one line each", () => {
    expect(monthLines(month({ stamps: 3, km: 12.34, stages: [3, 4, 5] }), words)).toEqual(["3 stamps", "12.3 km", "Stages 3, 4, 5"]);
    expect(monthLines(month({ stamps: 1, km: 4.96, stages: [9] }), words)).toEqual(["1 stamps", "5 km", "Stage 9"]);
  });

  it("AC-11: a month with no place and no extra stamp says so; one with only extra stamps names how many", () => {
    expect(monthLines(month({}), words)).toEqual(["none"]);
    expect(monthLines(month({ extraStamps: 2, stages: [4] }), words)).toEqual(["2 extra", "Stage 4"]);
    expect(monthLines(month({ stamps: 2, km: 3, extraStamps: 1, stages: [1, 2] }), words)).toEqual(["2 stamps", "3 km", "1 extra", "Stages 1, 2"]);
  });

  // The real messages with the real plural rules of each language (spec 0037 AC-14).
  const real = (locale: string): MonthWords => {
    const t = createTranslator({ locale: locale as Locale, messages: messageFiles[locale] as unknown as typeof import("../../messages/en.json"), namespace: "stats" });
    const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    return {
      stamps: (count) => t("tipStamps", { count }),
      extraStamps: (count) => t("tipExtra", { count }),
      none: t("tipNone"),
      km: (km) => t("tipKm", { km: n.format(km) }),
      stage: (list) => t("tipStage", { list }),
      stages: (list) => t("tipStages", { list }),
    };
  };

  it("AC-14: Russian has its four plural forms for stamps and extra stamps", () => {
    const w = real("ru");
    expect([1, 2, 5, 11, 21, 22, 25].map(w.stamps)).toEqual(["1 печать", "2 печати", "5 печатей", "11 печатей", "21 печать", "22 печати", "25 печатей"]);
    expect([1, 3, 5].map(w.extraStamps)).toEqual(["1 дополнительный штамп", "3 дополнительных штампа", "5 дополнительных штампов"]);
  });

  it("AC-14: English, Hungarian and German have their forms, and every language names stages and km", () => {
    expect([1, 2].map(real("en").stamps)).toEqual(["1 stamp", "2 stamps"]);
    expect([1, 2].map(real("hu").stamps)).toEqual(["1 bélyegzés", "2 bélyegzés"]);
    expect([1, 2].map(real("de").stamps)).toEqual(["1 Stempel", "2 Stempel"]);
    expect(monthLines(month({ stamps: 2, km: 12.3, stages: [3, 4] }), real("en"))).toEqual(["2 stamps", "12.3 km", "Stages 3, 4"]);
    expect(monthLines(month({ stamps: 1, km: 7, stages: [3] }), real("hu"))).toEqual(["1 bélyegzés", "7 km", "3. szakasz"]);
    expect(monthLines(month({}), real("de"))).toEqual(["In diesem Monat keine Stempel"]);
    expect(monthLines(month({ stamps: 1, km: 1.5, stages: [1, 2] }), real("ru"))).toEqual(["1 печать", "1,5 км", "Этапы 1, 2"]);
  });

  it("AC-14: every language has the texts of the tooltip", () => {
    for (const locale of routing.locales) {
      const w = real(locale);
      for (const text of [w.none, w.stamps(1), w.extraStamps(1), w.km(1), w.stage("1"), w.stages("1, 2")]) expect(text.trim(), locale).not.toBe("");
    }
  });
});
