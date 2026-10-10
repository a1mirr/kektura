import fs from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("spec 0022: fresh-context review", () => {
  it("AC-1: CLAUDE.md states the rule, names the agent and says what the author tells it", () => {
    const claude = read("CLAUDE.md");
    expect(claude).toContain("Fresh-context review before merge");
    expect(claude).toContain("`fresh-reviewer`");
    expect(claude).toMatch(
      /only the task's issue number \(`#N`; the spec number for a change that is only a spec, `none` for a small change that has neither\) and the base branch/,
    );
    expect(claude).toMatch(/before it is merged/);
    expect(claude).toMatch(/Fix every valid finding and answer the rest in the pull request description/);
    expect(claude).toMatch(/with the commit that was reviewed/);
    expect(claude).toMatch(/a review of an earlier state doesn't count/);
    expect(claude).toMatch(/Never hand a pull request over as ready to merge without it/);
    expect(claude).toMatch(/leave the working tree alone while the review runs/);
    expect(claude).toMatch(/Fixes that change code, tests or behaviour get another fresh review/);
    expect(claude).toMatch(/wording-only fixes don't/);
    expect(claude).toMatch(/documentation included/);
    expect(claude).toMatch(/Dependabot's pull requests are not/);
  });

  it("AC-1: CLAUDE.md lists the spec among the places the rules live", () => {
    expect(read("CLAUDE.md")).toMatch(/fresh-context review before merge: 0022/);
  });

  it("AC-2: the specs workflow ends with the review, after the specs are made true", () => {
    const readme = read("specs/README.md");
    const steps = readme.slice(readme.indexOf("## Workflow"), readme.indexOf("## Where tests live"));
    const lastStep = [...steps.matchAll(/^(\d+)\. \*\*(.+?)\*\*/gm)].at(-1);
    expect(lastStep?.[2]).toMatch(/review/i);
    expect(steps).toContain("fresh-reviewer");
    expect(steps).toContain("`none`");
    expect(steps).toContain("only the task's issue number");
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

    it("checks the tree again just before reporting, and tolerates ignored build artefacts", () => {
      expect(body).toMatch(/Just before you report, run `git status --short` and `git rev-parse --short HEAD` again/);
      expect(body).toMatch(/someone changed the tree while you were reviewing/);
      expect(body).toContain("tsconfig.tsbuildinfo");
    });

    it("checks every migration against the running code, its name and the regenerated types (a merge deploys by itself)", () => {
      expect(body).toMatch(/A migration in the diff that the code running in production could not live with while it is applied/);
      expect(body).toMatch(/takes two merges, the second after the first has deployed: spec\s+0026 AC-5/);
      expect(body).toMatch(/not named `NNNN_slug\.sql` after the number of the task issue that adds it/);
      expect(body).toMatch(/regenerated types \(`npm run types:gen`\)/);
      expect(body).toMatch(/A merge deploys by itself, so nobody else will look at this/);
      expect(read("specs/project/0022-fresh-context-review.md")).toMatch(/checks every migration in the diff against spec 0026 AC-5/);
      expect(read("CLAUDE.md")).toMatch(/a migration in the diff that the code running in production could not live with while it is applied/);
    });

    it("checks that comments earn their place, and its brief carries the Comments rule of CLAUDE.md verbatim", () => {
      const rule = /^## Comments\r?\n([\s\S]+?)\r?\n\r?\n## Gotchas/m.exec(read("CLAUDE.md"))?.[1];
      expect(rule, "the Comments section of CLAUDE.md").toMatch(/strictly FORBIDDEN/);
      expect(body).toContain(rule!);
      expect(body).toMatch(/A comment that has not earned its place/);
      expect(read("CLAUDE.md")).toMatch(/a comment that has not earned its place \(the Comments section below\)/);
      expect(read("specs/project/0022-fresh-context-review.md")).toMatch(/comments that have not earned their place/);
    });

    it("checks spec hygiene and reads (does not run) the E2E specs", () => {
      expect(body).toMatch(/Spec hygiene/);
      expect(body).toMatch(/marked `Removed`|instead of marked `Removed`/);
      expect(body).toMatch(/Do not run `npm run e2e`/);
      expect(body).toMatch(/read the E2E specs instead/);
    });

    it("reviews against origin/main by default, fetched first, and does not trust a stale local main", () => {
      expect(body).toMatch(/branch \(default `origin\/main`, after `git fetch origin`\)/);
      expect(body).toMatch(/run `git fetch origin` first/);
      expect(read("CLAUDE.md")).toMatch(/the base branch \(`origin\/main`, after `git fetch origin`: a local `main` can be stale\)/);
    });

    it("starts from CLAUDE.md and the spec (or the owning specs for `none`), and runs the checks", () => {
      expect(body).toContain("CLAUDE.md");
      expect(body).toMatch(/specs\/product\/NNNN/);
      expect(body).toMatch(/specs\/project\/NNNN/);
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
        /every language/,
        /gotchas/,
        /signed-out visitors, for each locale, on a 375 px wide screen and with JavaScript off/,
        /Security and privacy/,
      ]) {
        expect(body).toMatch(topic);
      }
    });

    it("checks that every requirement of the task holds and that no spec describes unbuilt behaviour", () => {
      expect(body).toMatch(/A requirement of the task that the built change does not satisfy/);
      expect(body).toMatch(/describes behaviour that is\s+not built/);
      expect(read("specs/project/0022-fresh-context-review.md")).toMatch(/requirements of the task that do not hold/);
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
    expect(template).toMatch(/^- \[ \] .*task came first.*every requirement holds.*needs no task/m);
    expect(template).toMatch(/^- \[ \] .*specs this change touches mirror the code as built and describe nothing that is not built.*Spec changes/m);
    expect(template).toMatch(/^- \[ \] .*npm run check.*npm run e2e/m);
    expect(template).toMatch(/^- \[ \] .*fresh-context agent.*fresh-reviewer.*at the commit named below.*later commits only fix wording/m);
    expect(template).toMatch(/^## Review findings/m);
    expect(template).toMatch(/^Reviewed commit:/m);
  });
});

describe("spec 0018: the changelog rule", () => {
  it("AC-7: CLAUDE.md asks for an entry, in every language, in the same pull request", () => {
    const claude = read("CLAUDE.md");
    expect(claude).toMatch(/\*\*Changelog\*\* \(spec 0018 AC-7\)/);
    expect(claude).toMatch(/adds or extends an entry in `src\/content\/changelog\.ts` in the same pull request, in every language/);
    expect(claude).toMatch(/process, test, refactor and deploy-file changes add none/);
    expect(claude).toMatch(/joins that entry/);
  });

  it("AC-7: a feature flag that is on in production is no excuse, and its state is looked up, in CLAUDE.md, the template, the reviewer's brief and the spec", () => {
    expect(read("CLAUDE.md")).toMatch(/A feature flag is no excuse while it is on in production \(look it up/);
    expect(read(".github/pull_request_template.md")).toContain("a feature flag that is on in production does not make it invisible");
    expect(read(".claude/agents/fresh-reviewer.md")).toMatch(/A feature flag does not excuse a missing entry while it is on in production: look up the production state/);
    expect(read("specs/product/0018-changelog.md")).toMatch(/A feature flag does not excuse a missing entry while the flag is on in\s+production/);
  });

  it("AC-7: the pull request template asks for it", () => {
    expect(read(".github/pull_request_template.md")).toMatch(/^- \[ \] .*users can see is in the changelog.*src\/content\/changelog\.ts/m);
  });

  it("AC-7: the reviewer checks that what users can see is in the changelog", () => {
    const body = read(".claude/agents/fresh-reviewer.md");
    expect(body).toMatch(/A change users can see \(texts, names, pages, behaviour\) with no entry in `src\/content\/changelog\.ts`/);
    expect(body).toContain("spec 0018 AC-7");
  });
});

describe("spec 0007: CI is the authority for the end-to-end tests", () => {
  it("AC-8: CLAUDE.md, specs/README.md, the pull request template and the Stop hook say that CI's job decides and a local run is for failures", () => {
    const claude = read("CLAUDE.md");
    expect(claude).toMatch(/CI's "End-to-end tests" job is the authority for the end-to-end tests \(spec 0007 AC-8\)/);
    expect(claude).toMatch(/run `npm run e2e` locally only to reproduce a failure/);
    expect(claude).toMatch(/CI's end-to-end job is looked at before the merge/);
    expect(read("specs/README.md")).toMatch(/CI's "End-to-end tests" job is the authority and must be green on the pull request/);
    expect(read("specs/README.md")).toMatch(/run `npm run e2e` locally only to reproduce a failure/);
    expect(read(".github/pull_request_template.md")).toMatch(/^- \[ \] .*CI's end-to-end job is green \(`npm run e2e` locally only to reproduce a failure\)/m);
  });

  it("AC-8: nothing still tells the author to run the end-to-end tests before committing", () => {
    for (const file of ["CLAUDE.md", "specs/README.md", ".github/pull_request_template.md", ".claude/hooks/stop-check.mjs"]) {
      expect(read(file), file).not.toMatch(/run `npm run e2e` (yourself )?before committing/);
      expect(read(file), file).not.toMatch(/`npm run e2e` was run for/);
    }
  });
});
