import fs from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const ci = read(".github/workflows/ci.yml");
const lines = ci.split("\n");

function job(id: string) {
  const start = lines.findIndex((line) => line === `  ${id}:`);
  expect(start, `a job "${id}"`).toBeGreaterThan(-1);
  const end = lines.findIndex((line, i) => i > start && /^ {2}\S/.test(line));
  return lines.slice(start, end === -1 ? undefined : end).join("\n");
}
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
    it("is triggered by pull requests, by pushes to main and by the weekly security run, nothing else", () => {
      expect(ci).toContain('\non:\n  push:\n    branches: [main]\n  pull_request:\n  schedule:\n    - cron: "17 5 * * 1"\n');
      expect(ci.match(/^ {2}(push|pull_request|workflow_dispatch|schedule|workflow_run|create):/gm)).toEqual(["  push:", "  pull_request:", "  schedule:"]);
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
      expect(job("security")).toContain("name: Security checks");
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
      expect(e2e).toContain("\n    if: github.event_name != 'schedule' && (github.event_name != 'pull_request' || needs.check.outputs.code_changed == 'true')\n");
      // a status function in the condition would drop the implied success() and let a failed check job start this one
      expect(e2e.slice(0, e2e.indexOf("steps:"))).not.toMatch(/always\(\)|failure\(\)|cancelled\(\)/);
    });

    it("adds no job for it: the detection is a step of the check job (Review recorded and Security checks are jobs of their own, for other reasons)", () => {
      const jobIds = lines.slice(lines.indexOf("jobs:") + 1).filter((line) => /^ {2}[a-z][\w-]*:$/.test(line));
      expect(jobIds).toEqual(["  check:", "  review:", "  e2e:", "  security:"]);
    });
  });

  it("AC-2: the e2e job starts the local Supabase, installs Chromium and runs the suite, keeping the report when it fails", () => {
    const e2e = job("e2e");
    expect(e2e).toContain("name: End-to-end tests");
    expect(e2e).toContain("runs-on: ubuntu-latest");
    expect(step(e2e, "Start local Supabase")).toMatch(/npx supabase start -x /);
    expect(step(e2e, "Database rule tests")).toContain("npx vitest run tests/friends-migration.test.ts tests/database-rules.test.ts tests/seed-cleanup.test.ts tests/feature-flags-database.test.ts tests/flag-admin-database.test.ts tests/stamp-dates-database.test.ts tests/retired-stamps-database.test.ts");
    expect(e2e).toContain("npx playwright install --with-deps chromium");
    expect(e2e).toMatch(/- run: npm run e2e\b/);
    const upload = step(e2e, "Upload Playwright report");
    expect(upload).toContain("if: failure()");
    expect(upload).toContain("path: playwright-report/");
  });

  describe("AC-12, AC-13: the database tests cannot skip in CI", () => {
    const e2e = job("e2e");
    const database = step(e2e, "Database rule tests");

    it("only the database step of the e2e job requires the database", () => {
      expect(database).toMatch(/env:\s*\n\s+REQUIRE_LOCAL_DB: "1"/);
      expect(job("check")).not.toContain("REQUIRE_LOCAL_DB");
      expect(job("review")).not.toContain("REQUIRE_LOCAL_DB");
      expect(ci.match(/REQUIRE_LOCAL_DB: /g)).toHaveLength(1);
      expect(e2e.replace(database, "")).not.toContain("REQUIRE_LOCAL_DB: ");
    });

    it("nothing else sets it: no other workflow, no git hook, no Stop hook, no npm script, no test server script", () => {
      const others = [
        ...fs.readdirSync(new URL("../.github/workflows/", import.meta.url)).filter((f) => f !== "ci.yml").map((f) => `.github/workflows/${f}`),
        ...fs.readdirSync(new URL("../.githooks/", import.meta.url)).map((f) => `.githooks/${f}`),
        ".claude/hooks/stop-check.mjs",
        ".claude/settings.json",
        "package.json",
        "scripts/test-env.mjs",
        "playwright.config.ts",
      ];
      for (const file of others) expect(read(file), file).not.toContain("REQUIRE_LOCAL_DB");
    });

    it("the step writes the vitest JSON report and the next step checks it with the script, which fails the job", () => {
      expect(database).toMatch(/--reporter=default --reporter=json --outputFile\.json=database-tests-report\.json/);
      const check = step(e2e, "Every database test ran");
      expect(check).toContain("run: node scripts/check-database-tests.mjs database-tests-report.json");
      expect(check).not.toMatch(/continue-on-error|\|\| true/);
      expect(e2e.indexOf("- name: Every database test ran")).toBeGreaterThan(e2e.indexOf("- name: Database rule tests"));
      expect(fs.existsSync(new URL("../scripts/check-database-tests.mjs", import.meta.url))).toBe(true);
    });

    it("the step starts after Supabase has started", () => {
      expect(e2e.indexOf("Database rule tests")).toBeGreaterThan(e2e.indexOf("Start local Supabase"));
    });
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

describe("spec 0007: the security job", () => {
  const security = job("security");
  const header = security.slice(0, security.indexOf("steps:"));
  const scans = security.match(/gitleaks" (git|dir) .*/g) ?? [];

  describe("AC-14: when it runs", () => {
    it("runs for pull requests, for pushes to main and once a week (a cron expression for one day of the week)", () => {
      const cron = ci.match(/^ {4}- cron: "([^"]+)"$/m)?.[1] ?? "";
      expect(cron).toMatch(/^\d{1,2} \d{1,2} \* \* [0-6]$/);
      expect(header).not.toMatch(/^ {4}if:/m);
      expect(header).not.toContain("needs:");
      expect(header).toContain("name: Security checks");
      expect(header).toContain("runs-on: ubuntu-latest");
    });

    it("is the only job of the weekly run: the others skip the schedule (and the pull-request-only job never ran for it)", () => {
      expect(job("check")).toContain("\n    if: github.event_name != 'schedule'\n");
      expect(job("e2e")).toContain("github.event_name != 'schedule' && ");
      expect(job("review")).toContain("if: github.event_name == 'pull_request' &&");
    });

    it("reads the whole history, needs no secret and no permission beyond reading the contents", () => {
      expect(security).toMatch(/- uses: actions\/checkout@v\d+\s*\n\s+with:\s*\n\s+fetch-depth: 0\b/);
      expect(security).not.toMatch(/secrets\.|permissions:|GITHUB_TOKEN|GH_TOKEN/);
      expect(ci).toMatch(/\npermissions:\n {2}contents: read\n/);
    });

    it("no step of it can fail quietly: no continue-on-error, nothing but npm audit's own status is ignored", () => {
      expect(security).not.toMatch(/continue-on-error/);
      expect(security.match(/\|\| true/g)).toHaveLength(1);
    });
  });

  describe("AC-15: npm audit and the allow-list", () => {
    const audit = step(security, "Known vulnerabilities in production dependencies");

    it("runs npm audit for production dependencies at level high, and hands the report to the script that applies the allow-list", () => {
      expect(audit).toContain('npm audit --omit=dev --audit-level=high --json > "$RUNNER_TEMP/audit-report.json" || true');
      expect(audit).toContain('node scripts/check-audit.mjs "$RUNNER_TEMP/audit-report.json" .github/audit-allowlist.json');
      expect(audit.indexOf("npm audit")).toBeLessThan(audit.indexOf("check-audit.mjs"));
      expect(audit).not.toMatch(/--force|npm audit fix|--include=dev/);
      expect(fs.existsSync(new URL("../scripts/check-audit.mjs", import.meta.url))).toBe(true);
      expect(fs.existsSync(new URL("../.github/audit-allowlist.json", import.meta.url))).toBe(true);
    });

    it("runs even when an earlier step failed, so one run reports both kinds of finding", () => {
      expect(audit).toContain("if: ${{ !cancelled() }}");
    });
  });

  describe("AC-16: gitleaks", () => {
    const install = step(security, "Install gitleaks");

    it("is a pinned release: a version, the sha256 of its archive, verified before anything is extracted or run", () => {
      expect(header).toMatch(/\n {6}GITLEAKS_VERSION: "\d+\.\d+\.\d+"\n/);
      expect(header).toMatch(/\n {6}GITLEAKS_SHA256: "[0-9a-f]{64}"\n/);
      expect(install).toContain(
        "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz",
      );
      expect(install).toContain("set -euo pipefail");
      expect(install).toContain('echo "${GITLEAKS_SHA256}  ${archive}" | sha256sum --check --strict');
      const [download, verify, extract, runIt] = ["curl ", "sha256sum --check", "tar ", 'gitleaks" version'].map((s) => install.indexOf(s));
      expect(download).toBeGreaterThan(-1);
      expect(verify).toBeGreaterThan(download);
      expect(extract).toBeGreaterThan(verify);
      expect(runIt).toBeGreaterThan(extract);
      expect(security).not.toMatch(/\/latest\/|releases\/latest|gitleaks-action|@master|@main/);
    });

    it("keeps the archive and the binary outside the working tree it scans", () => {
      expect(install).toContain('archive="$RUNNER_TEMP/gitleaks.tar.gz"');
      expect(install).toContain('--directory "$RUNNER_TEMP" gitleaks');
    });

    it("scans the git history and the working tree, with the repository's configuration, after it is installed", () => {
      const history = step(security, "Secrets in the git history");
      const tree = step(security, "Secrets in the working tree");
      expect(history).toContain('"$RUNNER_TEMP/gitleaks" git --config .gitleaks.toml');
      expect(tree).toContain('"$RUNNER_TEMP/gitleaks" dir --config .gitleaks.toml');
      expect(history.trimEnd().endsWith(" .")).toBe(true);
      expect(tree.trimEnd().endsWith(" .")).toBe(true);
      expect(security.indexOf("- name: Secrets in the git history")).toBeGreaterThan(security.indexOf("- name: Install gitleaks"));
      expect(security.indexOf("- name: Secrets in the working tree")).toBeGreaterThan(security.indexOf("- name: Install gitleaks"));
      for (const s of [history, tree]) expect(s).toContain("steps.gitleaks.outcome == 'success'"); // not a second error for a missing binary
      expect(fs.existsSync(new URL("../.gitleaks.toml", import.meta.url))).toBe(true);
    });

    it("redacts: every scan has --redact, and nothing makes gitleaks or the shell more talkative than that", () => {
      expect(scans).toHaveLength(2);
      for (const scan of scans) expect(scan, scan).toContain(" --redact ");
      expect(security).not.toMatch(/--redact=0|--no-redact|set -x|--log-level[= ](debug|trace)|ACTIONS_STEP_DEBUG|--report-path|--report-format|\btee\b/);
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
