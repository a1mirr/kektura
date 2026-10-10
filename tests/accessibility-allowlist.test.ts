import { describe, expect, it } from "vitest";
import { judge, type Allowed, type Finding } from "../e2e/accessibility";
import { ALLOWED } from "../e2e/accessibility-allowlist";

const finding = (rule: string, extra: Partial<Finding> = {}): Finding => ({
  rule,
  impact: "serious",
  width: "desktop",
  help: "help",
  elements: ["#a"],
  count: 1,
  ...extra,
});
const allowed = (rule: string, extra: Partial<Allowed> = {}): Allowed => ({ rule, page: "dashboard", reason: "because", ...extra });

describe("spec 0006: the accessibility allow-list", () => {
  it("AC-12: a serious or critical violation that nobody listed is reported, a listed one is not", () => {
    const result = judge("dashboard", [finding("color-contrast"), finding("label", { impact: "critical" })], [allowed("color-contrast")]);
    expect(result.unlisted.map((f) => f.rule)).toEqual(["label"]);
    expect(result.stale).toEqual([]);
  });

  it("AC-12: an entry for a rule that no longer fires is stale, so the test fails until it is deleted", () => {
    const result = judge("dashboard", [finding("label")], [allowed("label"), allowed("color-contrast")]);
    expect(result.stale.map((a) => a.rule)).toEqual(["color-contrast"]);
    expect(judge("dashboard", [], [allowed("label")]).stale).toHaveLength(1);
  });

  it("AC-12: an entry covers the page it names and nothing else", () => {
    expect(judge("account", [finding("label")], [allowed("label")]).unlisted).toHaveLength(1);
    expect(judge("account", [], [allowed("label")]).stale).toEqual([]);
  });

  it("AC-12: an entry without a width covers both widths and lives while either fires; one with a width only that width", () => {
    const phone = finding("label", { width: "phone" });
    expect(judge("dashboard", [phone], [allowed("label")])).toMatchObject({ unlisted: [], stale: [] });
    expect(judge("dashboard", [phone], [allowed("label", { width: "desktop" })])).toMatchObject({ unlisted: [phone] });
    expect(judge("dashboard", [phone], [allowed("label", { width: "desktop" })]).stale).toHaveLength(1);
    expect(judge("dashboard", [phone], [allowed("label", { width: "phone" })])).toMatchObject({ unlisted: [], stale: [] });
  });

  it("AC-11: minor and moderate findings do not fail a page, and an entry for one is stale", () => {
    const moderate = finding("region", { impact: "moderate" });
    const result = judge("dashboard", [moderate, finding("tabindex", { impact: "minor" })], [allowed("region")]);
    expect(result.unlisted).toEqual([]);
    expect(result.ungated.map((f) => f.rule)).toEqual(["region", "tabindex"]);
    expect(result.stale.map((a) => a.rule)).toEqual(["region"]);
  });

  it("AC-12: every real entry says why, and is for one rule on one page once", () => {
    for (const entry of ALLOWED) expect(entry.reason.trim(), `${entry.page}/${entry.rule}`).not.toBe("");
    const keys = ALLOWED.map((a) => `${a.page}/${a.rule}/${a.width ?? "both"}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
