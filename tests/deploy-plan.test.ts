// Spec 0026 AC-12: what is deployed after a merge. The decision is a pure function; the git calls around it
// are injected, so every case can be stated without a repository.
import { describe, expect, it } from "vitest";
import { needsDeploy, planDeploy } from "../scripts/lib/deploy.mjs";
import { inspect, productionMain, Problem } from "../scripts/deploy-plan.mjs";

const A = "a".repeat(40);
const B = "b".repeat(40);

describe("spec 0026: which merges deploy", () => {
  describe("AC-12: needsDeploy", () => {
    it.each([
      ["a spec", ["specs/0026-automatic-deploy.md"]],
      ["tests and E2E", ["tests/messages.test.ts", "e2e/account.spec.ts"]],
      ["a markdown file anywhere", ["README.md", "deploy/README.md", "docs/notes.md"]],
      ["repository tooling", [".github/workflows/ci.yml", ".github/pull_request_template.md", ".claude/agents/fresh-reviewer.md", ".githooks/pre-push"]],
      ["nothing at all", []],
    ])("%s do not need a deploy", (_name, paths) => {
      expect(needsDeploy(paths)).toBe(false);
    });

    it.each([
      ["app code", ["src/app/[locale]/account/page.tsx"]],
      ["a migration", ["supabase/migrations/0025_x.sql"]],
      ["the deploy files (the hook, the Caddyfile)", ["deploy/post-receive"]],
      ["the dependencies", ["package.json"]],
      ["the messages", ["messages/en.json"]],
      ["one app file among documents", ["specs/0026-automatic-deploy.md", "CLAUDE.md", "src/lib/progress.ts"]],
      ["a test-looking path outside tests/", ["src/lib/progress.test.ts"]],
    ])("%s need a deploy", (_name, paths) => {
      expect(needsDeploy(paths)).toBe(true);
    });
  });

  describe("AC-12: planDeploy", () => {
    it("deploys when production has no main yet", () => {
      expect(planDeploy({ production: "", target: A })).toMatchObject({ deploy: true });
    });

    it("skips a commit production already runs", () => {
      expect(planDeploy({ production: A, target: A, changed: ["src/x.ts"] })).toMatchObject({ deploy: false, reason: expect.stringMatching(/already runs this commit/) });
    });

    it("skips a commit older than production's, so a late run never puts old code over new", () => {
      expect(planDeploy({ production: B, target: A, changed: ["src/x.ts"], targetIsBehind: true })).toMatchObject({
        deploy: false,
        reason: expect.stringMatching(/newer commit/),
      });
    });

    it("skips a merge that changed only documentation, specs, tests and tooling, and says why", () => {
      const plan = planDeploy({ production: A, target: B, changed: ["specs/0025-account-page.md", "tests/x.test.ts", "CLAUDE.md"] });
      expect(plan.deploy).toBe(false);
      expect(plan.reason).toMatch(/documentation, specs, tests and repository tooling/);
    });

    it("deploys a merge that changed something production runs, and counts the files", () => {
      expect(planDeploy({ production: A, target: B, changed: ["src/a.ts", "specs/x.md"] })).toEqual({ deploy: true, reason: "2 changed files since production's commit" });
      expect(planDeploy({ production: A, target: B, changed: ["supabase/migrations/0025_x.sql"] }).reason).toMatch(/^1 changed file since/);
    });
  });
});

// A fake `git`: answers by the arguments it is called with.
const git = (answers: Record<string, { status: number; stdout?: string; stderr?: string }>) => (...args: string[]) => {
  const answer = answers[args.join(" ")];
  if (!answer) throw new Error(`unexpected git ${args.join(" ")}`);
  return { status: answer.status, stdout: answer.stdout ?? "", stderr: answer.stderr ?? "" };
};

describe("spec 0026 AC-12: what is read from git", () => {
  it("takes production's main from `git ls-remote`, or nothing when it has none", () => {
    expect(productionMain("production", git({ "ls-remote production refs/heads/main": { status: 0, stdout: `${A}\trefs/heads/main\n` } }))).toBe(A);
    expect(productionMain("production", git({ "ls-remote production refs/heads/main": { status: 0, stdout: "" } }))).toBe("");
  });

  it("says how to fix an unreachable production instead of deploying blind", () => {
    const run = git({ "ls-remote production refs/heads/main": { status: 128, stderr: "Permission denied (publickey)." } });
    expect(() => productionMain("production", run)).toThrow(Problem);
    expect(() => productionMain("production", run)).toThrow(/deploy key.*DEPLOY_KNOWN_HOSTS|DEPLOY_KNOWN_HOSTS/);
  });

  it("lists the changed paths and whether the target is behind production", () => {
    const run = git({
      [`cat-file -e ${A}^{commit}`]: { status: 0 },
      [`diff --name-only --no-renames ${A} ${B}`]: { status: 0, stdout: "src/a.ts\nspecs/x.md\n" },
      [`merge-base --is-ancestor ${B} ${A}`]: { status: 1 },
    });
    expect(inspect(A, B, run)).toEqual({ changed: ["src/a.ts", "specs/x.md"], targetIsBehind: false, comparable: true });
  });

  it("lists both sides of a rename: moving app code into tests/ or specs/ must not look like a docs-only merge", () => {
    let asked: string[] = [];
    const run = (...args: string[]) => {
      if (args[0] === "diff") asked = args;
      return { status: args[0] === "merge-base" ? 1 : 0, stdout: "", stderr: "" };
    };
    inspect(A, B, run);
    expect(asked).toContain("--no-renames"); // by default git prints only the new path of a rename
  });

  it("notices a target that production already contains", () => {
    const run = git({
      [`cat-file -e ${B}^{commit}`]: { status: 0 },
      [`diff --name-only --no-renames ${B} ${A}`]: { status: 0, stdout: "src/a.ts\n" },
      [`merge-base --is-ancestor ${A} ${B}`]: { status: 0 },
    });
    expect(inspect(B, A, run).targetIsBehind).toBe(true);
  });

  it("cannot compare with a commit this history doesn't know (an emergency rollback), and says so", () => {
    expect(inspect(A, B, git({ [`cat-file -e ${A}^{commit}`]: { status: 1 } }))).toMatchObject({ comparable: false });
  });

  it("has nothing to compare when production has no main or already runs the target", () => {
    expect(inspect("", B, git({}))).toMatchObject({ comparable: true, changed: [] });
    expect(inspect(B, B, git({}))).toMatchObject({ comparable: true, changed: [] });
  });
});
