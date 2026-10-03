import { describe, expect, it } from "vitest";
import { slowestTests, toMarkdown } from "../scripts/slowest-tests.mjs";

const report = {
  suites: [
    {
      file: "a.spec.ts",
      specs: [{ title: "fast", tests: [{ results: [{ duration: 100 }] }] }],
      suites: [{ specs: [{ title: "slow | pipe", tests: [{ results: [{ duration: 4000 }, { duration: 1000 }] }] }] }],
    },
    { file: "b.spec.ts", specs: [{ title: "middle", tests: [{ results: [{ duration: 900 }] }] }] },
  ],
};

describe("spec 0030: the slowest-tests report", () => {
  it("AC-4: lists tests slowest first, summing retries and reading nested suites", () => {
    const rows = slowestTests(report, 2);
    expect(rows.map((r: { title: string }) => r.title)).toEqual(["slow | pipe", "middle"]);
    expect(rows[0].ms).toBe(5000);
    expect(rows[0].file).toBe("a.spec.ts");
  });

  it("AC-4: renders a Markdown table with the pipe escaped", () => {
    const md = toMarkdown(slowestTests(report, 3));
    expect(md).toContain("| 5.0 | a.spec.ts: slow \\| pipe |");
    expect(md.split("\n")).toHaveLength(4 + 3);
  });
});
