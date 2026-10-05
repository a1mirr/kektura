// Spec 0007: the properties of the CI workflow and of Dependabot's configuration, so a later edit can't remove
// them unnoticed. The workflow itself only runs on GitHub; this pins what it is made of.
import fs from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const ci = read(".github/workflows/ci.yml");
const lines = ci.split("\n");

// The text of one job (from `  name:` at two spaces of indentation to the next job).
function job(id: string) {
  const start = lines.findIndex((line) => line === `  ${id}:`);
  expect(start, `a job "${id}"`).toBeGreaterThan(-1);
  const end = lines.findIndex((line, i) => i > start && /^ {2}\S/.test(line));
  return lines.slice(start, end === -1 ? undefined : end).join("\n");
}
// The text of one step of a job, from its `- name:` line to the next step.
function step(jobText: string, name: string) {
  const jobLines = jobText.split("\n");
  const start = jobLines.findIndex((line) => line.includes(`- name: ${name}`));
  expect(start, `a step named "${name}"`).toBeGreaterThan(-1);
  const end = jobLines.findIndex((line, i) => i > start && /^ {6}- /.test(line));
  return jobLines.slice(start, end === -1 ? undefined : end).join("\n");
}

describe("spec 0007: the CI workflow", () => {
  it("AC-1: the check job runs on every pull request update and every push to main, on Node 24, with npm ci and npm run check", () => {
    const check = job("check");
    expect(check).toContain("name: Typecheck, lint, unit tests");
    expect(check).toContain("runs-on: ubuntu-latest");
    expect(check).toMatch(/node-version: 24\s*\n\s+cache: npm/);
    expect(check).toMatch(/- run: npm ci\s*\n\s+- run: npm run check/);
  });

  describe("AC-9: one run per change", () => {
    it("is triggered by pull requests and by pushes to main only", () => {
      expect(ci).toContain("\non:\n  push:\n    branches: [main]\n  pull_request:\n");
      expect(ci.match(/^ {2}(push|pull_request|workflow_dispatch|schedule|workflow_run|create):/gm)).toEqual(["  push:", "  pull_request:"]);
    });

    it("cancels the earlier run of a pull request when a new push arrives, and never a run on main (grouped by commit)", () => {
      expect(ci).toContain(
        "\nconcurrency:\n" +
          "  group: ci-${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.pull_request.number) || github.sha }}\n" +
          "  cancel-in-progress: ${{ github.event_name == 'pull_request' }}\n",
      );
    });

    it("keeps the job names the ruleset on main, the merge step and the deploy workflow refer to", () => {
      expect(job("check")).toContain("name: Typecheck, lint, unit tests");
      expect(job("e2e")).toContain("name: End-to-end tests");
      expect(job("review")).toContain("name: Review recorded");
    });
  });

  describe("AC-10: a Markdown-only pull request skips the end-to-end job", () => {
    it("the check job lists the changed files first, from a checkout deep enough for the merge commit, and publishes code_changed", () => {
      const check = job("check");
      expect(check).toContain("outputs:\n      code_changed: ${{ steps.changes.outputs.code_changed }}");
      expect(check).toMatch(/- uses: actions\/checkout@v\d+\s*\n\s+with:\s*\n\s+fetch-depth: 2/);
      const detect = step(check, "Does the change touch more than Markdown");
      expect(detect).toContain("id: changes");
      expect(detect).toContain("run: node scripts/ci-changes.mjs");
      expect(check.indexOf("scripts/ci-changes.mjs")).toBeLessThan(check.indexOf("npm ci"));
      expect(fs.existsSync(new URL("../scripts/ci-changes.mjs", import.meta.url))).toBe(true);
    });

    it("the e2e job waits for the check job, runs for every push, and for a pull request only when code changed", () => {
      const e2e = job("e2e");
      expect(e2e).toContain("\n    needs: check\n");
      expect(e2e).toContain("\n    if: github.event_name != 'pull_request' || needs.check.outputs.code_changed == 'true'\n");
      // a status function in the condition would drop the implied success() and let a failed check job start this one
      expect(e2e.slice(0, e2e.indexOf("steps:"))).not.toMatch(/always\(\)|failure\(\)|cancelled\(\)/);
    });

    it("adds no job for it: the detection is a step of the check job (the pull-request-only job Review recorded is the other one)", () => {
      const jobIds = lines.slice(lines.indexOf("jobs:") + 1).filter((line) => /^ {2}[a-z][\w-]*:$/.test(line));
      expect(jobIds).toEqual(["  check:", "  review:", "  e2e:"]);
    });
  });

  it("AC-2: the e2e job starts the local Supabase, installs Chromium and runs the suite, keeping the report when it fails", () => {
    const e2e = job("e2e");
    expect(e2e).toContain("name: End-to-end tests");
    expect(e2e).toContain("runs-on: ubuntu-latest");
    expect(step(e2e, "Start local Supabase")).toMatch(/npx supabase start -x /);
    expect(step(e2e, "Database rule tests")).toContain("npx vitest run tests/friends-migration.test.ts tests/database-rules.test.ts tests/seed-cleanup.test.ts tests/feature-flags-database.test.ts tests/flag-admin-database.test.ts");
    expect(e2e).toContain("npx playwright install --with-deps chromium");
    expect(e2e).toMatch(/- run: npm run e2e\b/);
    const upload = step(e2e, "Upload Playwright report");
    expect(upload).toContain("if: failure()");
    expect(upload).toContain("path: playwright-report/");
  });

  it("AC-3: the e2e job checks the generated types after Supabase has started; the scripts exist", () => {
    const e2e = job("e2e");
    expect(e2e.indexOf("npm run types:check")).toBeGreaterThan(e2e.indexOf("Start local Supabase"));
    const scripts = JSON.parse(read("package.json")).scripts;
    expect(scripts["types:gen"]).toBe("node scripts/db-types.mjs gen");
    expect(scripts["types:check"]).toBe("node scripts/db-types.mjs check");
    expect(read("scripts/db-types.mjs")).toMatch(/--local --schema public/);
  });

  it("AC-5: nothing in the CI workflow reads a secret", () => {
    expect(ci).not.toMatch(/\$\{\{\s*secrets\./);
  });

  describe("AC-6: the caches", () => {
    const e2e = job("e2e");

    it("restores Playwright's browsers keyed by the locked version, and Next's build cache keyed by lockfile and sources", () => {
      expect(e2e).toMatch(/path: ~\/\.cache\/ms-playwright\s*\n\s+key: playwright-\$\{\{ runner\.os \}\}-\$\{\{ steps\.playwright\.outputs\.version \}\}/);
      expect(e2e).toContain("require('@playwright/test/package.json').version");
      expect(e2e).toMatch(/path: \.next-e2e\/cache\s*\n\s+key: next-e2e-.*hashFiles\('package-lock\.json'\).*hashFiles\('src\/\*\*'/);
      expect(e2e).toMatch(/restore-keys: next-e2e-\$\{\{ runner\.os \}\}-\$\{\{ hashFiles\('package-lock\.json'\) \}\}-/);
    });

    it("drops the restored reference-data cache after restoring and before building", () => {
      const drop = step(e2e, "Drop the restored reference-data cache");
      expect(drop).toContain("rm -rf .next-e2e/cache/fetch-cache");
      expect(e2e.indexOf("Drop the restored reference-data cache")).toBeGreaterThan(e2e.indexOf("path: .next-e2e/cache"));
      expect(e2e.indexOf("- run: npm run e2e")).toBeGreaterThan(e2e.indexOf("Drop the restored reference-data cache"));
    });
  });

  describe("AC-7: the slowest-tests report", () => {
    it("adds the json reporter in CI through PLAYWRIGHT_JSON_OUTPUT_NAME and prints the table even when the suite failed", () => {
      expect(read("playwright.config.ts")).toMatch(/process\.env\.PLAYWRIGHT_JSON_OUTPUT_NAME \? \[\["json"\] as const\] : \[\]/);
      expect(job("e2e")).toMatch(/- run: npm run e2e\s*\n\s+env:\s*\n\s+PLAYWRIGHT_JSON_OUTPUT_NAME: e2e-report\.json/);
      const slowest = step(job("e2e"), "Slowest E2E tests");
      expect(slowest).toContain("if: always()");
      expect(slowest).toContain('node scripts/slowest-tests.mjs e2e-report.json 10 >> "$GITHUB_STEP_SUMMARY"');
    });
  });
});

describe("spec 0007: Dependabot", () => {
  const dependabot = read(".github/dependabot.yml");

  it("AC-4: weekly pull requests for npm and for GitHub Actions", () => {
    expect(dependabot).toMatch(/package-ecosystem: npm\s*\n\s+directory: \/\s*\n\s+schedule:\s*\n\s+interval: weekly/);
    expect(dependabot).toMatch(/package-ecosystem: github-actions\s*\n\s+directory: \/\s*\n\s+schedule:\s*\n\s+interval: weekly/);
  });

  it("AC-4: minor and patch updates of npm come as one grouped pull request, majors separately", () => {
    expect(dependabot).toMatch(/groups:\s*\n(?:\s*#.*\n)*\s+npm-minor-patch:\s*\n\s+update-types:\s*\n\s+- minor\s*\n\s+- patch/);
    expect(dependabot).not.toMatch(/- major/);
  });

  it("AC-4: major updates of typescript, eslint and @types/node are ignored", () => {
    for (const name of ["typescript", "eslint", '"@types/node"']) {
      expect(dependabot, name).toMatch(new RegExp(`dependency-name: ${name}\\s*\\n\\s+update-types:\\s*\\n\\s+- version-update:semver-major`));
    }
  });
});
