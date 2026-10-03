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
  it("AC-1: the check job runs on every push and pull request, on Node 24, with npm ci and npm run check", () => {
    expect(ci).toMatch(/^on:\s*\n\s+push:\s*\n\s+pull_request:/m);
    const check = job("check");
    expect(check).toContain("name: Typecheck, lint, unit tests");
    expect(check).toContain("runs-on: ubuntu-latest");
    expect(check).toMatch(/node-version: 24\s*\n\s+cache: npm/);
    expect(check).toMatch(/- run: npm ci\s*\n\s+- run: npm run check/);
  });

  it("AC-2: the e2e job starts the local Supabase, installs Chromium and runs the suite, keeping the report when it fails", () => {
    const e2e = job("e2e");
    expect(e2e).toContain("name: End-to-end tests");
    expect(e2e).toContain("runs-on: ubuntu-latest");
    expect(step(e2e, "Start local Supabase")).toMatch(/npx supabase start -x /);
    expect(step(e2e, "Database rule tests")).toContain("npx vitest run tests/friends-migration.test.ts tests/database-rules.test.ts");
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
