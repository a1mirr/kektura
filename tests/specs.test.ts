// specs/README.md rules (spec 0034): the index lists every spec with its real status, spec numbers are unique, specs
// are written in English, tasks are GitHub issues (the repository has no tasks/ folder), and the rules are written
// down where authors, the reviewer and the hook look.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const specsDir = new URL("../specs/", import.meta.url);
const SPEC_FOLDERS = ["product", "project"]; // spec 0034 AC-1: the only places a spec lives
const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const read = (dir: URL, name: string) => fs.readFileSync(new URL(name, dir), "utf8");
const readRoot = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const specFiles = SPEC_FOLDERS.flatMap((folder) =>
  fs
    .readdirSync(new URL(`${folder}/`, specsDir))
    .filter((name) => /^\d{4}-.+\.md$/.test(name))
    .map((name) => `${folder}/${name}`),
); // "product/0001-progress.md": relative to specs/

const indexOf = (readme: string) =>
  new Map(
    [...readme.matchAll(/^\| \[(\d{4})\]\(([^)]+)\) \|.*\| ([^|]+?) \|\r?$/gm)].map((m) => [m[2], { number: m[1], status: m[3] }]),
  );

describe("spec 0034: specs/README.md", () => {
  const indexed = indexOf(read(specsDir, "README.md"));

  it("AC-9: lists every spec once, and nothing else", () => {
    expect([...indexed.keys()].sort()).toEqual([...specFiles].sort());
  });

  it("AC-9: gives each spec the status written in its own file, and a spec's status is Done", () => {
    for (const name of specFiles) {
      const own = /^Status: (.+?)\s*$/m.exec(read(specsDir, name))?.[1];
      expect(own, `${name} has a "Status:" line`).toMatch(/^Done$/);
      expect(indexed.get(name)?.status, name).toBe(own);
      expect(indexed.get(name)?.number, name).toBe(baseName(name).slice(0, 4));
    }
  });

  it("AC-9: the index groups the specs by folder: every row under a \"product/\" or \"project/\" heading links into it, under a topic heading", () => {
    const index = read(specsDir, "README.md").split("\n## Index")[1] ?? "";
    let folder = "";
    let rows = 0;
    let topics = 0;
    for (const line of index.split("\n")) {
      const dir = /^### `(product|project)\/`$/.exec(line);
      if (dir) folder = dir[1];
      if (/^#### \S/.test(line)) topics += 1;
      const row = /^\| \[(\d{4})\]\(([^)]+)\) \|/.exec(line);
      if (!row) continue;
      rows += 1;
      expect(row[2].startsWith(`${folder}/`), `${row[1]} is listed under "${folder}/" but links ${row[2]}`).toBe(true);
    }
    expect(rows).toBe(specFiles.length);
    expect(topics).toBeGreaterThan(1);
  });

  it("AC-1: specs/ holds README.md, _template.md and the folders product/ and project/, nothing else", () => {
    expect(fs.readdirSync(specsDir).sort()).toEqual(["README.md", "_template.md", ...SPEC_FOLDERS].sort());
  });

  it("AC-1: every file in a spec folder is NNNN-slug.md, and the folders are not nested", () => {
    for (const folder of SPEC_FOLDERS) {
      for (const entry of fs.readdirSync(new URL(`${folder}/`, specsDir), { withFileTypes: true })) {
        expect(entry.isFile(), `${folder}/${entry.name} is a file`).toBe(true);
        expect(entry.name, `${folder}/${entry.name}`).toMatch(/^\d{4}-[a-z0-9-]+\.md$/);
      }
    }
  });

  it("AC-1: no spec number is used twice", () => {
    const numbers = specFiles.map((name) => baseName(name).slice(0, 4));
    expect(numbers.filter((n, i) => numbers.indexOf(n) !== i)).toEqual([]);
  });

  it("AC-1, AC-9: the repository has no tasks/ folder: tasks are GitHub issues", () => {
    expect(fs.existsSync(new URL("../tasks/", import.meta.url))).toBe(false);
  });

  it("AC-1: says specs and tasks are written in English", () => {
    expect(read(specsDir, "README.md")).toMatch(/Specs are always written in English/);
    expect(readRoot(".github/ISSUE_TEMPLATE/task.md")).toMatch(/Written in English/);
    expect(readRoot("CLAUDE.md")).toMatch(/Specs and tasks are always written in English/);
  });

  it("AC-9: has English-only specs and issue template (Cyrillic only where a line quotes the app's `ru` texts)", () => {
    const cyrillic = /[Ѐ-ӿ]/;
    const all = [
      ...[...specFiles, "README.md", "_template.md"].map((name) => ({ dir: specsDir, name })),
      { dir: new URL("../.github/ISSUE_TEMPLATE/", import.meta.url), name: "task.md" },
    ];
    for (const { dir, name } of all) {
      const offending = read(dir, name)
        .split(/\r?\n/)
        .filter((line) => cyrillic.test(line) && !line.includes("`ru`"));
      expect(offending, name).toEqual([]);
    }
  });

  it("AC-1, AC-3: the task template is an issue template with the label `task` and the sections", () => {
    const template = readRoot(".github/ISSUE_TEMPLATE/task.md");
    expect(template).toMatch(/^labels: task$/m);
    for (const section of ["## Specs", "## Goal", "## Done when", "## Requirements", "## Open questions", "## Notes"]) {
      expect(template).toContain(section);
    }
  });

  it("AC-2: a spec describes built behaviour only: its status is Done and the template has no open questions", () => {
    for (const name of specFiles) expect(read(specsDir, name), name).toMatch(/^Status: Done\s*$/m);
    const template = read(specsDir, "_template.md");
    expect(template).toMatch(/^Status: Done$/m);
    expect(template).not.toMatch(/Draft|Accepted|## Open questions/);
  });

  it("AC-3: a task that plans behaviour lists requirements, not acceptance criteria, and keeps its open questions", () => {
    const template = readRoot(".github/ISSUE_TEMPLATE/task.md");
    expect(template).toMatch(/^- \[ \] \*\*R-1\*\*/m);
    expect(template).toMatch(/no numbered acceptance criteria/);
    expect(template).toMatch(/Decisions still needed from the owner before coding/);
  });

  it("AC-3: the pull request template closes the task and has a \"Spec changes\" section", () => {
    const template = readRoot(".github/pull_request_template.md");
    expect(template).toMatch(/^Closes #/m);
    expect(template).toMatch(/^## Spec changes$/m);
  });
});

describe("spec 0034: the rules are written where authors and the reviewer look", () => {
  const claude = readRoot("CLAUDE.md");
  const readme = read(specsDir, "README.md");

  it("AC-1, AC-2, AC-4: the specs README says what a spec and a task are and how to tell them apart", () => {
    expect(readme).toMatch(/A spec is the contract of one \*\*area\*\*/);
    expect(readme).toMatch(/written as it behaves\s+\*\*now\*\*/);
    expect(readme).toMatch(/A task is history and never says how the\s+product behaves/);
    expect(readme).toMatch(/will it still be true in\s+a year if\s+nobody touches it/);
    expect(readme).toMatch(/Spec numbers are their own sequence/);
    expect(readme).toMatch(/a task's number is its issue\s+number/);
  });

  it("AC-2, AC-3, AC-4: the workflow starts as a task and writes the spec while building, never before", () => {
    const steps = readme.slice(readme.indexOf("## Workflow"), readme.indexOf("## Where tests live"));
    const titles = [...steps.matchAll(/^(\d+)\. \*\*(.+?)\*\*/gm)].map((m) => m[2]);
    expect(titles[0]).toMatch(/open a task/i);
    expect(steps).toMatch(/No spec is written or changed yet/);
    expect(steps).toMatch(/\*\*Write the ACs and the tests as you build\.\*\*/);
    expect(steps).toMatch(/status `Done`/);
    expect(readme).toMatch(/never describes behaviour that is not built yet/);
    expect(claude).toMatch(/A feature or behaviour change starts as a task/);
    expect(readRoot(".github/ISSUE_TEMPLATE/task.md")).toMatch(/written into the owning specs as the behaviour is built/);
  });

  it("AC-2, AC-4: nothing tells the author to draft or accept a spec before the code is built", () => {
    for (const file of ["CLAUDE.md", "README.md", "specs/README.md", "specs/_template.md", ".github/ISSUE_TEMPLATE/task.md", ".claude/agents/fresh-reviewer.md", ".github/pull_request_template.md", ".claude/hooks/stop-check.mjs"]) {
      const text = readRoot(file);
      expect(text, file).not.toMatch(/drafts? the (owning )?spec|edits the spec first|edits or drafts|The spec came first|status `(Draft|Accepted)`|Spec and task first/);
    }
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
    expect(steps).toMatch(/Closes #N/);
    expect(readme).toMatch(/A spec found to disagree with the code at any other time is a\s+defect/);
  });

  it("AC-4, AC-5, AC-6: CLAUDE.md states the split, the migration naming and the close-out", () => {
    expect(claude).toMatch(/\*\*Task first\*\* \(spec 0034\)/);
    expect(claude).toMatch(/starts as a task, an issue opened with `gh issue create`/);
    expect(claude).toMatch(/No spec is drafted beforehand: a spec describes only behaviour that is built/);
    expect(claude).toMatch(/check off every requirement of the task or strike it with the reason/);
    expect(claude).toMatch(/will the sentence still be true in a year/);
    expect(claude).toMatch(/Spec numbers are their own sequence/);
    expect(claude).toMatch(/Tests cite specs, never tasks/);
    expect(claude).toMatch(/named `NNNN_slug\.sql` after the number of the task issue that adds it/);
    expect(claude).toMatch(/\*\*Build, then make the specs true\.\*\*/);
    expect(claude).toMatch(/reread every spec the task touches against the code \*as built\*/);
    expect(claude).toMatch(/where code and spec disagree, decide which is right and fix that one/);
    expect(claude).toMatch(/A spec that is not true is a defect/);
    expect(claude).toMatch(/how the two work: 0034/);
  });

  it("AC-8: the reviewer checks the specs in both directions and the pull request's Spec changes", () => {
    expect(claude).toMatch(/specs true in both directions, not only where the diff touches them/);
    expect(claude).toMatch(/a pull request whose "Spec changes" section is empty or untrue/);
    expect(claude).toMatch(/requirements of the task that do not hold/);
    expect(claude).toMatch(/no spec describing behaviour that is not built/);
    const body = readRoot(".claude/agents/fresh-reviewer.md");
    expect(body).toMatch(/You are told a task's issue number/);
    expect(body).toContain("specs/project/0034-specs-and-tasks.md");
    expect(body).toMatch(/in both directions and beyond the lines the diff touches/);
    expect(body).toMatch(/Goal or Notes tell the story of a change/);
    expect(body).toMatch(/a pull request whose "Spec changes" section is empty/);
    expect(body).toMatch(/A requirement of the task that the built change does not satisfy/);
    expect(body).toMatch(/describes behaviour that is\s+not built/);
  });

  it("AC-10: the Stop hook watches specs/ and asks when app code changed without a spec change", () => {
    const hook = readRoot(".claude/hooks/stop-check.mjs");
    expect(hook).toMatch(/WATCHED = \[\s*"specs",\s*"src",/);
    expect(hook).toMatch(/import \{ nudgeKey, nudgeToAsk \} from "\.\/stop-nudges\.mjs"/);
    expect(hook).toMatch(/nudgeToAsk\(changed, committed, state\.nudged, scope\)/);
    expect(readRoot(".claude/hooks/stop-nudges.mjs")).toMatch(/app code changed without a spec change/);
  });
});

// Spec 0034 AC-9: what can be checked mechanically about "a spec mirrors the code". Whether an AC is really
// satisfied only a person or the reviewer can tell; these catch the drift that leaves a trace.
describe("spec 0034: specs and the repository agree", () => {
  const skipDirs = new Set(["node_modules", ".git", ".next", ".next-test", ".next-e2e", ".claude", "playwright-report", "test-results"]);
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (skipDirs.has(entry.name)) return [];
      const full = `${dir}/${entry.name}`;
      return entry.isDirectory() ? walk(full) : [full];
    });
  const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1").replace(/\/$/, "");
  const testFiles = ["src", "tests", "e2e", "scripts"].flatMap((d) => walk(`${root}/${d}`)).filter((f) => /\.(test\.tsx?|spec\.ts)$/.test(f));

  const acsOf = new Map(
    specFiles.map((name) => [baseName(name).slice(0, 4), new Set([...read(specsDir, name).matchAll(/^- \*\*AC-(\d+)\*\*/gm)].map((m) => Number(m[1])))]),
  );

  it("AC-9: a test title that cites an AC (under describe(\"spec NNNN …\") or as \"NNNN AC-n\") cites one that exists", () => {
    const dangling: string[] = [];
    for (const file of testFiles) {
      let spec: string | null = null;
      fs.readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          const describe = /describe\(\s*["`']spec (\d{4})/.exec(line);
          if (describe) spec = describe[1];
          const title = /\b(?:it|test)(?:\.each\([^)]*\))?\(\s*["`']([^"`']*)/.exec(line);
          if (!title) return;
          let current = spec;
          for (const m of title[1].matchAll(/(?:(\d{4}) )?AC-(\d+)/g)) {
            if (m[1]) current = m[1];
            if (current && !acsOf.get(current)?.has(Number(m[2]))) dangling.push(`${file.slice(root.length + 1)}:${i + 1} cites spec ${current} AC-${m[2]}`);
          }
        });
    }
    expect(dangling).toEqual([]);
  });

  it("AC-9: repository files named in backticks by a spec exist", () => {
    const rooted = /^(src|scripts|e2e|tests|supabase|deploy|public|messages|specs|\.github|\.githooks)\//;
    const loose = new Set(["playwright.config.ts", "next.config.ts", "package.json", "tsconfig.json", "CLAUDE.md", "README.md"]);
    const missing: string[] = [];
    for (const name of specFiles) {
      const text = read(specsDir, name);
      for (const m of text.matchAll(/`([^`\s]+)`/g)) {
        const path = m[1].replace(/[,.;:)]+$/, "");
        if (!(rooted.test(path) || loose.has(path)) || /[*<>{}$|]|\.\.\.|NNNN/.test(path)) continue;
        if (!fs.existsSync(`${root}/${path}`)) missing.push(`${name}: ${path}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("spec 0034: manual checks", () => {
  const coverageRows = (text: string) =>
    (text.split(/^## Coverage\s*$/m)[1] ?? "")
      .split("\n")
      .filter((line) => line.startsWith("|") && !/^\|\s*(AC\s*\||-{3})/.test(line));

  it("AC-11: every coverage row of a spec that says manual gives a reason and a Last checked (also when it says by hand or review)", () => {
    const incomplete: string[] = [];
    let manualRows = 0;
    for (const name of specFiles) {
      const text = read(specsDir, name);
      for (const row of coverageRows(text).filter((line) => /\bmanual\b|\bby hand\b|checked in review|\breview (of|by)\b/i.test(line))) {
        manualRows += 1;
        const cell = row.slice(0, 60);
        if (!/\bmanual \([^)]+\)/.test(row)) incomplete.push(`${name}: no "manual (reason)": ${cell}`);
        if (!/Last checked: (\d{4}-\d{2}-\d{2}|never|every pull request)/.test(row)) incomplete.push(`${name}: no "Last checked": ${cell}`);
      }
    }
    expect(manualRows, "the rule has rows to look at").toBeGreaterThan(5);
    expect(incomplete).toEqual([]);
  });

  it("AC-11: the rule is written where authors and the reviewer look", () => {
    expect(readRoot("CLAUDE.md")).toMatch(/gets a `manual` coverage row with its reason, how to check it and when it was last checked/);
    expect(readRoot("CLAUDE.md")).toMatch(/the `manual` coverage rows of the touched areas/);
    expect(read(specsDir, "README.md")).toMatch(/`manual \(why it can't be automated\): how to check it\. Last checked: <date>`/);
    expect(readRoot(".claude/agents/fresh-reviewer.md")).toMatch(/A `manual` coverage row of a touched area \(spec 0034 AC-11\)/);
  });
});

// Spec 0034 AC-9: a spec is cited by number or by its real path. Every path that names a spec in a tracked text file,
// and every relative Markdown link, points at a file that exists; the old flat path (before the specs moved into
// product/ and project/) is not used anywhere. Fixtures with made-up names are not allowed either.
describe("spec 0034: spec paths and links resolve", () => {
  const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1").replace(/\/$/, "");
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter((f) => /\.(md|ts|tsx|mjs|mts|yml)$/.test(f) || f.startsWith(".githooks/"));
  const specPaths = new Set(specFiles.map((name) => `specs/${name}`));
  // Built from parts so that this file does not match its own patterns.
  const specPath = new RegExp("specs/(?:([a-z-]+)/)?(\\d{4}-[a-z0-9-]+\\.md)", "g");

  it("AC-9: every path that names a spec is a spec that exists, in its folder", () => {
    const wrong: string[] = [];
    for (const file of tracked) {
      fs.readFileSync(`${root}/${file}`, "utf8").split("\n").forEach((line, i) => {
        for (const m of line.matchAll(specPath)) {
          if (!m[1] || !SPEC_FOLDERS.includes(m[1]) || !specPaths.has(m[0])) wrong.push(`${file}:${i + 1} ${m[0]}`);
        }
      });
    }
    expect(wrong).toEqual([]);
  });

  it("AC-9: every relative Markdown link in a tracked Markdown file points at a file that exists", () => {
    const broken: string[] = [];
    for (const file of tracked.filter((f) => f.endsWith(".md"))) {
      const text = fs.readFileSync(`${root}/${file}`, "utf8").replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
      for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = m[1].split("#")[0];
        if (!target || /^(https?:|mailto:)/.test(target)) continue;
        if (!fs.existsSync(path.resolve(root, path.dirname(file), target))) broken.push(`${file} -> ${m[1]}`);
      }
    }
    expect(broken).toEqual([]);
  });
});
