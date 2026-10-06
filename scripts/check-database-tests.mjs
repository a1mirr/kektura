// Spec 0007 AC-13: reads the JSON report of CI's database rule tests (`vitest run --reporter=json`) and fails when no test
// ran or when any was skipped, so a database that was not reachable, or a test file that forgot the helper of
// `e2e/local-db.ts`, can never turn the step green without the rules being checked.
// Usage: node scripts/check-database-tests.mjs [report.json]
import { readFileSync } from "node:fs";

// The tests of a vitest JSON report, one entry per test with the file it is in and its status.
function testsOf(report) {
  return (report.testResults ?? []).flatMap((file) =>
    (file.assertionResults ?? []).map((t) => ({ file: file.name, title: t.fullName ?? t.title, status: t.status })),
  );
}

// What is wrong with the run, as a list of sentences; empty when every test ran (passed or failed: a failure fails the
// vitest step before this one).
export function databaseReportProblems(report) {
  const tests = testsOf(report);
  const problems = [];
  if (tests.length === 0) problems.push("no database test ran");
  const notRun = tests.filter((t) => t.status !== "passed" && t.status !== "failed");
  for (const t of notRun) problems.push(`${t.status}: ${t.file.replaceAll("\\", "/").split("/tests/").pop()}: ${t.title}`);
  return problems;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/").split("/").pop())) {
  const file = process.argv[2] ?? "database-tests-report.json";
  let report;
  try {
    report = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new Error(`${file} is missing or not a JSON report: the database tests did not report`);
  }
  const problems = databaseReportProblems(report);
  if (problems.length > 0) {
    throw new Error(`The database rule tests must all run in CI:\n- ${problems.join("\n- ")}`);
  }
  console.log(`All ${testsOf(report).length} database tests ran.`);
}
