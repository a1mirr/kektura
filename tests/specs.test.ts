// specs/README.md and tasks/README.md rules (spec 0034): the indexes list every spec and task with its real status,
// numbers are unique across both folders, both are written in English, and the rules are written down where
// authors, the reviewer and the hook look.
import fs from "node:fs";
import { describe, expect, it } from "vitest";

const specsDir = new URL("../specs/", import.meta.url);
const tasksDir = new URL("../tasks/", import.meta.url);
const files = (dir: URL) => fs.readdirSync(dir).filter((name) => /^\d{4}-.+\.md$/.test(name));
const read = (dir: URL, name: string) => fs.readFileSync(new URL(name, dir), "utf8");
const readRoot = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const specFiles = files(specsDir);
const taskFiles = files(tasksDir);

const indexOf = (readme: string) =>
  new Map(
    [...readme.matchAll(/^\| \[(\d{4})\]\(([^)]+)\) \|.*\| (\w+) \|\r?$/gm)].map((m) => [m[2], { number: m[1], status: m[3] }]),
  );

describe("spec 0034: specs/README.md and tasks/README.md", () => {
  describe.each([
    { kind: "spec", dir: specsDir, names: specFiles, statuses: /^(Draft|Accepted|Done)$/ },
    { kind: "task", dir: tasksDir, names: taskFiles, statuses: /^(Open|In progress|Done|Dropped)$/ },
  ])("$kind index", ({ kind, dir, names, statuses }) => {
    const indexed = indexOf(read(dir, "README.md"));

    it(`AC-9: lists every ${kind} once, and nothing else`, () => {
      expect([...indexed.keys()].sort()).toEqual([...names].sort());
    });

    it(`AC-9: gives each ${kind} the status written in its own file, a status that exists for a ${kind}`, () => {
      for (const name of names) {
        const own = /^Status: (.+?)\s*$/m.exec(read(dir, name))?.[1];
        expect(own, `${name} has a "Status:" line`).toMatch(statuses);
        expect(indexed.get(name)?.status, name).toBe(own);
        expect(indexed.get(name)?.number, name).toBe(name.slice(0, 4));
      }
    });
  });

  it("AC-1: no number is used twice across specs/ and tasks/", () => {
    const numbers = [...specFiles, ...taskFiles].map((name) => name.slice(0, 4));
    expect(numbers.filter((n, i) => numbers.indexOf(n) !== i)).toEqual([]);
  });

  it("AC-1: says specs and tasks are written in English", () => {
    expect(read(specsDir, "README.md")).toMatch(/Specs are always written in English/);
    expect(read(tasksDir, "README.md")).toMatch(/Written in English/);
    expect(readRoot("CLAUDE.md")).toMatch(/Specs and tasks are always written in English/);
  });

  it("AC-9: has English-only specs and tasks (Cyrillic only where a line quotes the app's `ru` texts)", () => {
    const cyrillic = /[Ѐ-ӿ]/;
    const all = [
      ...[...specFiles, "README.md", "_template.md"].map((name) => ({ dir: specsDir, name })),
      ...[...taskFiles, "README.md", "_template.md"].map((name) => ({ dir: tasksDir, name })),
    ];
    for (const { dir, name } of all) {
      const offending = read(dir, name)
        .split(/\r?\n/)
        .filter((line) => cyrillic.test(line) && !line.includes("`ru`"));
      expect(offending, name).toEqual([]);
    }
  });

  it("AC-1: every task file has a status and a Specs line, and the task template shows the sections", () => {
    for (const name of taskFiles) {
      const text = read(tasksDir, name);
      expect(text, name).toMatch(/^Specs: .+/m);
      expect(text, name).toMatch(/^## Goal$/m);
    }
    const template = read(tasksDir, "_template.md");
    for (const section of ["## Goal", "## Done when", "## Spec changes", "## Notes"]) expect(template).toContain(section);
    expect(template).toMatch(/^Status: Open \| In progress \| Done \| Dropped$/m);
  });

  it("AC-3: a task has no acceptance criteria", () => {
    for (const name of taskFiles) expect(read(tasksDir, name), name).not.toMatch(/^\s*- \*\*AC-\d+\*\*/m);
  });

  it("AC-3: a Done task says what changed in the specs", () => {
    for (const name of taskFiles) {
      const text = read(tasksDir, name);
      if (!/^Status: Done\s*$/m.test(text)) continue;
      const section = /^## Spec changes\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(text)?.[1].trim();
      expect(section, `${name} has a filled "Spec changes" section`).toBeTruthy();
    }
  });
});

describe("spec 0034: the rules are written where authors and the reviewer look", () => {
  const claude = readRoot("CLAUDE.md");
  const readme = read(specsDir, "README.md");

  it("AC-2, AC-4: the specs README says what a spec and a task are and how to tell them apart", () => {
    expect(readme).toMatch(/A spec is the contract of one \*\*area\*\*/);
    expect(readme).toMatch(/written as it behaves\s+\*\*now\*\*/);
    expect(readme).toMatch(/A task is history and never says how the product behaves/);
    expect(readme).toMatch(/will it still be true in a year if\s+nobody touches it/);
    expect(readme).toMatch(/one number sequence/);
  });

  it("AC-6, AC-7: the workflow has a step that makes the specs true, before the review", () => {
    const steps = readme.slice(readme.indexOf("## Workflow"), readme.indexOf("## Where tests live"));
    const titles = [...steps.matchAll(/^(\d+)\. \*\*(.+?)\*\*/gm)].map((m) => m[2]);
    const mirror = titles.findIndex((t) => /make the spec true/i.test(t));
    const review = titles.findIndex((t) => /review/i.test(t));
    expect(mirror).toBeGreaterThan(-1);
    expect(review).toBeGreaterThan(mirror);
    expect(steps).toMatch(/Where code and spec disagree, decide which is right and fix that one/);
    expect(steps).toMatch(/"Spec changes" section/);
    expect(readme).toMatch(/A spec found to disagree with the code at any other time is a\s+defect/);
  });

  it("AC-4, AC-5, AC-6: CLAUDE.md states the split, the migration naming and the close-out", () => {
    expect(claude).toMatch(/\*\*Spec and task first\*\* \(spec 0034\)/);
    expect(claude).toMatch(/will the sentence still be true in a year/);
    expect(claude).toMatch(/One number sequence runs over both folders/);
    expect(claude).toMatch(/Tests cite specs, never tasks/);
    expect(claude).toMatch(/named `NNNN_slug\.sql` after the number of the task that adds it/);
    expect(claude).toMatch(/\*\*Build, then make the specs true\.\*\*/);
    expect(claude).toMatch(/reread every spec the task touches against the code \*as built\*/);
    expect(claude).toMatch(/where code and spec disagree, decide which is right and fix that one/);
    expect(claude).toMatch(/A spec that is not true is a defect/);
    expect(claude).toMatch(/how the two work: 0034/);
  });

  it("AC-8: the reviewer checks the specs in both directions and the tasks' Spec changes", () => {
    expect(claude).toMatch(/specs true in both directions, not only where the diff touches them/);
    expect(claude).toMatch(/a task whose "Spec changes" section is empty or untrue/);
    const body = readRoot(".claude/agents/fresh-reviewer.md");
    expect(body).toMatch(/You are told a task number/);
    expect(body).toContain("specs/0034-specs-and-tasks.md");
    expect(body).toMatch(/in both directions and beyond the lines the diff touches/);
    expect(body).toMatch(/Goal or Notes tell the story of a change/);
    expect(body).toMatch(/a task marked `Done` whose "Spec changes" section is empty/);
  });

  it("AC-10: the Stop hook watches tasks/ and asks when app code changed without a spec change", () => {
    const hook = readRoot(".claude/hooks/stop-check.mjs");
    expect(hook).toMatch(/WATCHED = \[\s*"specs",\s*"tasks",/);
    expect(hook).toMatch(/specChanged = changed\.some\(\(f\) => f\.startsWith\("specs\/"\)\)/);
    expect(hook).toMatch(/app code changed without a spec change/);
  });
});
