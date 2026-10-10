import { readFileSync } from "node:fs";

function testsOf(report) {
  return (report.testResults ?? []).flatMap((file) =>
    (file.assertionResults ?? []).map((t) => ({ file: file.name, title: t.fullName ?? t.title, status: t.status })),
  );
}

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
