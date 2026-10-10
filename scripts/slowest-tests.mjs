import { readFileSync } from "node:fs";

export function slowestTests(report, count = 10) {
  const rows = [];
  const walk = (suite, file) => {
    for (const spec of suite.specs ?? []) {
      const ms = (spec.tests ?? []).flatMap((t) => t.results ?? []).reduce((sum, r) => sum + (r.duration ?? 0), 0);
      rows.push({ file: suite.file ?? file, title: spec.title, ms });
    }
    for (const child of suite.suites ?? []) walk(child, suite.file ?? file);
  };
  for (const suite of report.suites ?? []) walk(suite, suite.file);
  return rows.sort((a, b) => b.ms - a.ms).slice(0, count);
}

export function toMarkdown(rows) {
  const lines = ["### Slowest E2E tests", "", "| Seconds | Test |", "| ---: | --- |"];
  for (const r of rows) lines.push(`| ${(r.ms / 1000).toFixed(1)} | ${r.file}: ${r.title.replace(/\|/g, "\\|")} |`);
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/").split("/").pop())) {
  const [file = "e2e-report.json", count = "10"] = process.argv.slice(2);
  console.log(toMarkdown(slowestTests(JSON.parse(readFileSync(file, "utf8")), Number(count))));
}
