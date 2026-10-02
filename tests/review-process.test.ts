// Spec 0022: every change is reviewed by an agent with no context before it is merged. The process lives in
// prose and in an agent definition, so these tests pin that it is written down where people and agents look.
import fs from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("spec 0022: fresh-context review", () => {
  it("AC-1: CLAUDE.md states the rule, names the agent and says what the author tells it", () => {
    const claude = read("CLAUDE.md");
    expect(claude).toContain("Fresh-context review before merge");
    expect(claude).toContain("`fresh-reviewer`");
    expect(claude).toMatch(/only the spec number \(`none` for a small change that has no spec\) and the base branch/);
    expect(claude).toMatch(/before it is merged/);
    expect(claude).toMatch(/Fix every valid finding and answer the rest in the pull request description/);
    expect(claude).toMatch(/with the commit that was reviewed/);
    expect(claude).toMatch(/a review of an earlier state doesn't count/);
    expect(claude).toMatch(/Never hand a pull request over as ready to merge without it/);
    expect(claude).toMatch(/Fixes that change code, tests or behaviour get another fresh review/);
    expect(claude).toMatch(/wording-only fixes don't/);
    expect(claude).toMatch(/documentation included/);
    expect(claude).toMatch(/Dependabot's pull requests are not/);
  });

  it("AC-1: CLAUDE.md lists the spec among the places the rules live", () => {
    expect(read("CLAUDE.md")).toMatch(/fresh-context review before merge: 0022/);
  });

  it("AC-2: the specs workflow ends with the review", () => {
    const readme = read("specs/README.md");
    const steps = readme.slice(readme.indexOf("## Workflow"), readme.indexOf("## Where tests live"));
    const lastStep = [...steps.matchAll(/^(\d+)\. \*\*(.+?)\*\*/gm)].at(-1);
    expect(lastStep?.[2]).toMatch(/review/i);
    expect(steps).toContain("fresh-reviewer");
    expect(steps).toContain("`none`");
  });

  describe("AC-3: the fresh-reviewer agent", () => {
    const file = read(".claude/agents/fresh-reviewer.md");
    const [, frontmatter = "", body = ""] = file.split(/^---\r?$/m);
    const field = (name: string) => new RegExp(`^${name}:\\s*(.+)$`, "m").exec(frontmatter)?.[1].trim();

    it("is named after its file and says when to use it", () => {
      expect(field("name")).toBe("fresh-reviewer");
      expect(field("description")).toMatch(/before a pull request is merged/);
    });

    it("has exactly the read tools: a missing `tools` line would hand it every tool", () => {
      expect(field("tools")?.split(/\s*,\s*/).sort()).toEqual(["Bash", "Glob", "Grep", "Read"]);
      expect(body).toMatch(/Write nothing/);
    });

    it("reviews the committed change and what is not committed, and says which commit and tree state", () => {
      expect(body).toContain("git diff <base>...HEAD");
      expect(body).toContain("git diff HEAD");
      expect(body).toContain("git status --short");
      expect(body).toContain("git rev-parse --short HEAD");
      expect(body).toMatch(/a review only counts for the commit it names/);
      expect(body).toMatch(/Start with the commit you reviewed/);
    });

    it("starts from CLAUDE.md and the spec (or the owning specs for `none`), and runs the checks", () => {
      expect(body).toContain("CLAUDE.md");
      expect(body).toMatch(/specs\/NNNN/);
      expect(body).toMatch(/`none`/);
      expect(body).toMatch(/should have had a spec/);
      expect(body).toContain("npm run check");
    });

    it("looks for what the spec asks for", () => {
      for (const topic of [
        /Do not trust the spec's status or its coverage table/,
        /not implemented as written, implemented twice/,
        /no test/,
        /no acceptance criterion describes/,
        /Leftovers/,
        /all three\s+languages/,
        /gotchas/,
        /signed-out visitors, for each locale, on a 375 px wide screen and with JavaScript off/,
        /Security and privacy/,
      ]) {
        expect(body).toMatch(topic);
      }
    });

    it("reports findings most severe first with file:line and a failing scenario, what was fine, and allows 'No findings'", () => {
      expect(body).toMatch(/most severe first/);
      expect(body).toContain("`file:line`");
      expect(body).toMatch(/concrete scenario/);
      expect(body).toMatch(/found fine/);
      expect(body).toContain("No findings");
    });
  });

  it("AC-4: the pull request template has the checklist, the reviewed commit and a place for the findings", () => {
    const template = read(".github/pull_request_template.md");
    expect(template).toMatch(/^- \[ \] .*spec came first.*needs no spec/m);
    expect(template).toMatch(/^- \[ \] .*npm run check.*npm run e2e/m);
    expect(template).toMatch(/^- \[ \] .*fresh-context agent.*fresh-reviewer.*at the commit named below.*later commits only fix wording/m);
    expect(template).toMatch(/^## Review findings/m);
    expect(template).toMatch(/^Reviewed commit:/m);
  });
});
