import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { changedForNudge, isUserVisible, nudgeMessage, nudgeKey, nudgeTargets, nudgeToAsk } from "../.claude/hooks/stop-nudges.mjs";

const readRoot = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("spec 0034: the Stop hook's turn-end nudge", () => {
  it("AC-10: app code without a spec change is asked about, a spec change silences it", () => {
    expect(nudgeTargets(["src/lib/progress.ts"]).appCode).toEqual(["src/lib/progress.ts"]);
    expect(nudgeTargets(["src/lib/progress.ts", "specs/product/0001-progress.md"]).appCode).toEqual([]);
    expect(nudgeMessage(["src/lib/progress.ts"])).toMatch(/app code changed without a spec change:\n {2}src\/lib\/progress\.ts/);
  });

  it("AC-10: tests, e2e, generated types and non-src files are not app code", () => {
    const quiet = ["src/lib/progress.test.ts", "src/x/y.test.tsx", "tests/specs.test.ts", "e2e/stamp.spec.ts", "src/lib/db.types.ts", "scripts/build-data.mjs", ".github/ISSUE_TEMPLATE/task.md"];
    expect(nudgeTargets(quiet).appCode).toEqual([]);
    expect(nudgeMessage(quiet)).toBe("");
  });

  it("AC-12: a message file, a page or layout, or a component without the changelog is asked about", () => {
    const visible = [
      "messages/en.json",
      "messages/ru.json",
      "src/app/[locale]/page.tsx",
      "src/app/[locale]/dashboard/page.tsx",
      "src/app/[locale]/layout.tsx",
      "src/app/page.tsx",
      "src/components/TrailMap.tsx",
      "src/components/map/Legend.tsx",
    ];
    expect(nudgeTargets(visible).userVisible).toEqual(visible);
    expect(nudgeMessage(["messages/hu.json"])).toMatch(/files users can see changed without a changelog entry:\n {2}messages\/hu\.json/);
    expect(nudgeMessage(["messages/hu.json"])).toMatch(/src\/content\/changelog\.ts in every language/);
  });

  it("AC-12: the changelog among the changed files silences the question", () => {
    expect(nudgeTargets(["messages/en.json", "src/content/changelog.ts"]).userVisible).toEqual([]);
    expect(nudgeMessage(["src/components/TrailMap.tsx", "src/content/changelog.ts", "specs/product/0003-map-route-planner.md"])).toBe("");
  });

  it("AC-12: tests, generated types and files users do not see are ignored", () => {
    for (const f of [
      "src/components/TrailMap.test.tsx",
      "src/components/db.types.ts",
      "src/app/[locale]/dashboard/actions.ts",
      "src/app/auth/signout/route.ts",
      "src/app/[locale]/dashboard/loading.tsx",
      "src/lib/progress.ts",
      "src/content/changelog.ts",
      "messages/notes.txt",
      "messages/nested/en.json",
      "specs/product/0018-changelog.md",
      "e2e/dashboard.spec.ts",
    ]) {
      expect(isUserVisible(f), f).toBe(false);
    }
  });

  it("AC-10, AC-12: both questions come in one message, so one round trip", () => {
    const message = nudgeMessage(["src/lib/progress.ts", "messages/en.json"]);
    expect(message).toMatch(/^Checks pass, but app code changed without a spec change:/);
    expect(message).toMatch(/\n\nAnd files users can see changed without a changelog entry:/);
    expect(message.match(/Checks pass/g)).toHaveLength(1);
    expect(nudgeMessage(["src/lib/progress.ts", "messages/en.json", "specs/product/0001-progress.md"])).not.toMatch(/without a spec change/);
  });

  it("AC-10, AC-12: the hook asks through this module, once per turn end", () => {
    const hook = readRoot(".claude/hooks/stop-check.mjs");
    expect(hook).toMatch(/input\.stop_hook_active \? "" : nudgeToAsk\(changed, committed, state\.nudged, scope\)/);
    expect(hook).toMatch(/scope = `\$\{head\}:\$\{fingerprint\}`/);
    expect(hook).toMatch(/"merge-base", "HEAD", "origin\/main"/);
    expect(hook).toMatch(/WATCHED = \[[^\]]*"messages",/);
  });

  it("AC-12: work already committed on the branch counts, so a clean working tree does not silence the question", () => {
    const committed = ["src/components/FriendActionButton.tsx", "messages/en.json"];
    expect(nudgeMessage(changedForNudge([], committed))).toMatch(/files users can see changed without a changelog entry/);
    expect(nudgeMessage(changedForNudge([], []))).toBe("");
    expect(changedForNudge(["a.ts", "b.ts"], ["b.ts", "c.ts"])).toEqual(["a.ts", "b.ts", "c.ts"]);
    expect(nudgeMessage(changedForNudge([], [...committed, "src/content/changelog.ts"]))).not.toMatch(/changelog entry/);
  });

  it("AC-12: the same message is not asked twice about the same state; a new commit, other files or a clean state ask again", () => {
    const committed = ["src/components/FriendActionButton.tsx"];
    const first = nudgeToAsk([], committed, undefined, "abc:1");
    expect(first).toMatch(/files users can see changed without a changelog entry/);
    const asked = nudgeKey("abc:1", first);
    expect(nudgeToAsk([], committed, asked, "abc:1")).toBe("");
    expect(nudgeToAsk([], committed, asked, "def:1")).toBe(first);
    expect(nudgeToAsk([], committed, asked, "abc:2")).toBe(first);
    expect(nudgeToAsk([], [...committed, "src/components/CompareMap.tsx"], asked, "abc:1")).not.toBe("");
    expect(nudgeToAsk([], [], asked, "abc:1")).toBe("");
    expect(nudgeToAsk([], [...committed, "src/content/changelog.ts", "specs/product/0003-map-route-planner.md"], undefined, "abc:1")).toBe("");
  });
});
