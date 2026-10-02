// Spec 0022: every change is reviewed by an agent with no context before it is merged. The process lives in
// prose and in an agent definition, so these tests pin that it is written down where people and agents look.
import fs from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("spec 0022: fresh-context review", () => {
  it("AC-1: CLAUDE.md states the rule, names the agent and says what the author tells it", () => {
    const claude = read("CLAUDE.md");
    expect(claude).toContain("Fresh-context review before merge");
    expect(claude).toContain("fresh-reviewer");
    expect(claude).toMatch(/only the spec number and the base branch/);
    expect(claude).toMatch(/before it is merged/);
    expect(claude).toMatch(/again after substantial fixes/);
  });

  it("AC-2: the specs workflow ends with the review", () => {
    const readme = read("specs/README.md");
    const steps = readme.slice(readme.indexOf("## Workflow"), readme.indexOf("## Where tests live"));
    const lastStep = [...steps.matchAll(/^(\d+)\. \*\*(.+?)\*\*/gm)].at(-1);
    expect(lastStep?.[2]).toMatch(/review/i);
    expect(steps).toContain("fresh-reviewer");
  });

  describe("AC-3: the fresh-reviewer agent", () => {
    const file = read(".claude/agents/fresh-reviewer.md");
    const [, frontmatter = "", body = ""] = file.split(/^---\r?$/m);
    const field = (name: string) => new RegExp(`^${name}:\\s*(.+)$`, "m").exec(frontmatter)?.[1].trim();

    it("is named after its file, says when to use it, and is read-only", () => {
      expect(field("name")).toBe("fresh-reviewer");
      expect(field("description")).toMatch(/before a pull request is merged/);
      const tools = (field("tools") ?? "").split(/\s*,\s*/);
      expect(tools.length).toBeGreaterThan(0);
      for (const writer of ["Edit", "Write", "NotebookEdit"]) expect(tools, writer).not.toContain(writer);
    });

    it("starts from CLAUDE.md and the spec, reads the diff against the base, runs the checks", () => {
      expect(body).toContain("CLAUDE.md");
      expect(body).toMatch(/specs\/NNNN/);
      expect(body).toContain("git diff <base>...HEAD");
      expect(body).toContain("npm run check");
    });

    it("looks for what the spec asks for", () => {
      for (const topic of [
        /not implemented/,
        /no test/,
        /no acceptance criterion describes/,
        /Leftovers/,
        /all three\s+languages/,
        /gotchas/,
        /signed-out/,
        /Security and privacy/,
      ]) {
        expect(body).toMatch(topic);
      }
    });

    it("reports findings with file:line and a failing scenario, and allows 'No findings'", () => {
      expect(body).toContain("`file:line`");
      expect(body).toMatch(/concrete scenario/);
      expect(body).toContain("No findings");
    });
  });

  it("AC-4: the pull request template has the checklist and a place for the findings", () => {
    const template = read(".github/pull_request_template.md");
    expect(template).toMatch(/^- \[ \] .*spec came first/m);
    expect(template).toMatch(/^- \[ \] .*fresh-context agent.*fresh-reviewer/m);
    expect(template).toMatch(/^## Review findings/m);
  });
});
