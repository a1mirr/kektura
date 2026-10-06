// Spec 0007 AC-13: the check after CI's database rule tests, which reads the JSON report of vitest and fails when no test
// ran or when one was skipped.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { databaseReportProblems } from "../scripts/check-database-tests.mjs";

const script = new URL("../scripts/check-database-tests.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const test = (status: string, title = "a rule") => ({ status, title, fullName: `suite ${title}` });
const report = (...files: { name: string; tests: ReturnType<typeof test>[] }[]) => ({
  testResults: files.map((f) => ({ name: `/repo/tests/${f.name}`, assertionResults: f.tests })),
});

describe("spec 0007: the check of the database tests' report", () => {
  it("AC-13: every test ran: no problem (a failed test is the vitest step's to report)", () => {
    expect(databaseReportProblems(report({ name: "a.test.ts", tests: [test("passed"), test("failed")] }, { name: "b.test.ts", tests: [test("passed")] }))).toEqual([]);
  });

  it("AC-13: no test at all is a problem, whatever the report looks like", () => {
    expect(databaseReportProblems(report())).toEqual(["no database test ran"]);
    expect(databaseReportProblems(report({ name: "a.test.ts", tests: [] }))).toEqual(["no database test ran"]);
    expect(databaseReportProblems({})).toEqual(["no database test ran"]);
  });

  it("AC-13: one skipped test, in any file, is a problem that names it", () => {
    const problems = databaseReportProblems(report({ name: "a.test.ts", tests: [test("passed")] }, { name: "b.test.ts", tests: [test("passed"), test("skipped", "the rule")] }));
    expect(problems).toEqual(["skipped: b.test.ts: suite the rule"]);
  });

  it("AC-13: a test that is todo or pending did not run either, and every skipped one is listed", () => {
    const problems = databaseReportProblems(report({ name: "a.test.ts", tests: [test("todo", "one"), test("pending", "two"), test("skipped", "three")] }));
    expect(problems).toHaveLength(3);
  });

  describe("the script", () => {
    const run = (content: unknown | undefined) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "db-report-"));
      const file = path.join(dir, "report.json");
      if (content !== undefined) fs.writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content));
      try {
        return spawnSync("node", [script, file], { encoding: "utf8" });
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    };

    it("AC-13: exits 0 when every test ran", () => {
      const result = run(report({ name: "a.test.ts", tests: [test("passed")] }));
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("All 1 database tests ran.");
    });

    it("AC-13: exits 1 and names the skipped test when one did not run", () => {
      const result = run(report({ name: "a.test.ts", tests: [test("passed"), test("skipped", "the rule")] }));
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("skipped: a.test.ts: suite the rule");
    });

    it("AC-13: exits 1 when no test ran, when the report is not JSON and when there is no report", () => {
      for (const content of [report(), "not json", undefined]) expect(run(content).status, JSON.stringify(content)).toBe(1);
    });
  });
});
