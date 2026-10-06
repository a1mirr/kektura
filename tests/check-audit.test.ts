// Spec 0007 AC-15: the check after `npm audit --omit=dev --audit-level=high --json`, which reads the report and the
// allow-list (`.github/audit-allowlist.json`: an advisory id, a reason and an expiry date per entry).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { advisoriesOf, auditProblems, MAX_DAYS_AHEAD, readAllowlist } from "../scripts/check-audit.mjs";

const script = fileURLToPath(new URL("../scripts/check-audit.mjs", import.meta.url));
const NOW = new Date("2026-10-06T12:00:00Z");
const day = (offset: number) => new Date(NOW.getTime() + offset * 86_400_000).toISOString().slice(0, 10);

const A = "GHSA-2222-cccc-ffff";
const B = "GHSA-3333-hhhh-jjjj";
const advisory = (id: string, over: Record<string, unknown> = {}) => ({
  source: 1000 + id.length,
  name: "left-pad",
  dependency: "left-pad",
  title: `Prototype pollution (${id})`,
  url: `https://github.com/advisories/${id}`,
  severity: "high",
  cwe: [],
  cvss: { score: 7.5 },
  range: "<2.0.0",
  ...over,
});
// A report like npm's version 2: one entry per package, `via` holds advisories (objects) or the packages that carry them.
const report = (vulnerabilities: Record<string, unknown>, counts: Record<string, number> = {}) => ({
  auditReportVersion: 2,
  vulnerabilities,
  metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0, ...counts } },
});
const entry = (over: Record<string, unknown> = {}) => ({ advisory: A, reason: "No fixed version yet; the vulnerable code path is not used.", expires: day(30), ...over });
const list = (...entries: unknown[]) => ({ entries });

describe("spec 0007: the check of npm audit's report", () => {
  describe("AC-15: what fails", () => {
    it("a report without vulnerabilities is fine", () => {
      expect(auditProblems(report({}), list(), NOW)).toEqual([]);
    });

    it("a high or a critical advisory in a production dependency fails and is named with its package, title and link", () => {
      const problems = auditProblems(
        report({ "left-pad": { name: "left-pad", severity: "high", via: [advisory(A)] }, "right-pad": { name: "right-pad", severity: "critical", via: [advisory(B, { name: "right-pad", severity: "critical" })] } }, { high: 1, critical: 1 }),
        list(),
        NOW,
      );
      expect(problems).toEqual([
        `high vulnerability in left-pad: Prototype pollution (${A}) (https://github.com/advisories/${A})`,
        `critical vulnerability in right-pad: Prototype pollution (${B}) (https://github.com/advisories/${B})`,
      ]);
    });

    it("low and moderate advisories do not fail", () => {
      const low = report({ x: { name: "x", severity: "moderate", via: [advisory(A, { severity: "moderate" }), advisory(B, { severity: "low" })] } }, { moderate: 1 });
      expect(auditProblems(low, list(), NOW)).toEqual([]);
    });

    it("an advisory that reaches several packages is reported once, whichever way it arrives", () => {
      const r = report(
        {
          "left-pad": { name: "left-pad", severity: "high", via: [advisory(A)] },
          app: { name: "app", severity: "high", via: ["left-pad"] }, // the package that carries it: no advisory of its own
          other: { name: "other", severity: "high", via: [advisory(A, { name: "other" })] },
        },
        { high: 3 },
      );
      expect(advisoriesOf(r).map((a: { id: string }) => a.id)).toEqual([A]);
      expect(auditProblems(r, list(), NOW)).toHaveLength(1);
    });

    it("an advisory without a GitHub advisory id is still reported, and no entry can cover it", () => {
      const noId = advisory(A, { url: "https://example.com/advisory/1" });
      const r = report({ "left-pad": { name: "left-pad", severity: "high", via: [noId] } }, { high: 1 });
      expect(auditProblems(r, list(entry()), NOW)).toHaveLength(1);
    });

    it("a report that is not a report fails: an error from npm, a missing field, nothing at all", () => {
      for (const bad of [null, {}, { error: { code: "ENOTFOUND", summary: "request failed" } }, { vulnerabilities: {} }, [], "text"]) {
        const problems = auditProblems(bad, list(), NOW);
        expect(problems, JSON.stringify(bad)).toHaveLength(1);
        expect(problems[0]).toContain("npm audit did not produce a report");
      }
      expect(auditProblems({ error: { code: "ENOTFOUND", summary: "request failed" } }, list(), NOW)[0]).toContain("ENOTFOUND: request failed");
    });

    it("a report that counts high vulnerabilities but names no advisory fails: the check cannot read it", () => {
      const problems = auditProblems(report({ x: { name: "x", severity: "high", via: ["y"] } }, { high: 1 }), list(), NOW);
      expect(problems).toEqual(["npm audit counts 1 high or critical vulnerabilities but the report names no advisory: the check cannot read it"]);
    });
  });

  describe("AC-15: the allow-list", () => {
    const failing = report({ "left-pad": { name: "left-pad", severity: "high", via: [advisory(A)] } }, { high: 1 });

    it("an entry that has not expired covers its advisory, and only that one (the id is not case sensitive)", () => {
      expect(auditProblems(failing, list(entry()), NOW)).toEqual([]);
      expect(auditProblems(failing, list(entry({ advisory: A.toLowerCase() })), NOW)).toEqual([]);
      const two = report({ a: { name: "a", severity: "high", via: [advisory(A)] }, b: { name: "b", severity: "high", via: [advisory(B, { name: "b" })] } }, { high: 2 });
      const problems = auditProblems(two, list(entry()), NOW);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain(B);
    });

    it("an entry runs through the end of its expiry day and fails from the next one", () => {
      expect(auditProblems(failing, list(entry({ expires: day(0) })), NOW)).toEqual([]);
      const problems = auditProblems(failing, list(entry({ expires: day(-1) })), NOW);
      expect(problems).toEqual([
        `allow-list entry ${A} expired on ${day(-1)}: fix the advisory, or renew the entry with a new reason and date`,
        `high vulnerability in left-pad: Prototype pollution (${A}) (https://github.com/advisories/${A})`,
      ]);
    });

    it("an expired entry fails even when its advisory is gone: a finished entry is deleted", () => {
      const problems = auditProblems(report({}), list(entry({ expires: day(-30) })), NOW);
      expect(problems).toEqual([`allow-list entry ${A} expired on ${day(-30)}: fix the advisory, or renew the entry with a new reason and date`]);
    });

    it(`an entry may run at most ${MAX_DAYS_AHEAD} days from today`, () => {
      expect(auditProblems(failing, list(entry({ expires: day(MAX_DAYS_AHEAD) })), NOW)).toEqual([]);
      const problems = auditProblems(failing, list(entry({ expires: day(MAX_DAYS_AHEAD + 1) })), NOW);
      expect(problems[0]).toContain(`more than ${MAX_DAYS_AHEAD} days from now`);
      expect(problems).toHaveLength(2); // and it covers nothing
    });

    it("a malformed entry is a problem of its own and covers nothing", () => {
      const bad: [string, unknown, string][] = [
        ["an advisory that is not an advisory id", entry({ advisory: "CVE-2026-1" }), "needs an \"advisory\""],
        ["no advisory", entry({ advisory: undefined }), "needs an \"advisory\""],
        ["no reason", entry({ reason: undefined }), "needs a \"reason\""],
        ["a blank reason", entry({ reason: "   " }), "needs a \"reason\""],
        ["no date", entry({ expires: undefined }), "needs an \"expires\" date"],
        ["a date that is not a day", entry({ expires: "2026-13-45" }), "needs an \"expires\" date"],
        ["a date in another shape", entry({ expires: "next month" }), "needs an \"expires\" date"],
        ["a misspelt field", entry({ expire: day(30) }), "unknown fields: expire"],
        ["an entry that is not an object", "GHSA", "is not an object"],
      ];
      for (const [what, value, message] of bad) {
        const problems = readAllowlist(list(value), NOW).problems;
        expect(problems.join("\n"), what).toContain(message);
        expect(auditProblems(failing, list(value), NOW).length, what).toBeGreaterThanOrEqual(2); // the entry, and the advisory it does not cover
      }
    });

    it("a file that is not { entries: [] } is a problem", () => {
      for (const bad of [null, [], {}, { entries: {} }, "x"]) {
        expect(readAllowlist(bad, NOW).problems, JSON.stringify(bad)).toEqual(['the allow-list must be an object with an "entries" array']);
      }
    });

    it("the committed allow-list is a well-formed file (its entries are checked against today's date by CI's job, not here)", () => {
      const committed = JSON.parse(fs.readFileSync(new URL("../.github/audit-allowlist.json", import.meta.url), "utf8"));
      expect(Object.keys(committed)).toEqual(["entries"]);
      expect(Array.isArray(committed.entries)).toBe(true);
      for (const e of committed.entries) expect(Object.keys(e).sort()).toEqual(["advisory", "expires", "reason"]);
    });
  });

  describe("AC-15: the script", () => {
    const run = (reportFile: unknown, allowlistFile: unknown) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-check-"));
      const write = (name: string, content: unknown) => {
        const file = path.join(dir, name);
        if (content !== undefined) fs.writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content));
        return file;
      };
      try {
        return spawnSync("node", [script, write("report.json", reportFile), write("allowlist.json", allowlistFile)], { encoding: "utf8" });
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    };
    const failing = report({ "left-pad": { name: "left-pad", severity: "high", via: [advisory(A)] } }, { high: 1 });

    it("exits 0 when nothing fails, and says so", () => {
      const result = run(report({}), list());
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("No high or critical vulnerability in the production dependencies.");
    });

    it("exits 0 for an advisory covered by an entry, and counts the entries", () => {
      const result = run(failing, list(entry({ expires: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10) })));
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("(1 allow-listed)");
    });

    it("exits 1 and names the advisory when one is not covered", () => {
      const result = run(failing, list());
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`high vulnerability in left-pad: Prototype pollution (${A})`);
    });

    it("exits 1 for an expired entry", () => {
      const result = run(failing, list(entry({ expires: "2000-01-01" })));
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`allow-list entry ${A} expired on 2000-01-01`);
    });

    it("exits 1 when the report is missing, empty or not JSON, or the allow-list is missing", () => {
      for (const [r, l, message] of [
        [undefined, list(), "is missing or not JSON: npm audit did not report"],
        ["", list(), "is missing or not JSON: npm audit did not report"],
        ["<html>", list(), "is missing or not JSON: npm audit did not report"],
        [report({}), undefined, "the allow-list must be a JSON file"],
      ] as const) {
        const result = run(r, l);
        expect(result.status, String(message)).toBe(1);
        expect(result.stderr).toContain(message);
      }
    });

    it("exits 1 for a report that says npm failed", () => {
      const result = run({ error: { code: "ENOTFOUND", summary: "request failed" } }, list());
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("npm audit did not produce a report (ENOTFOUND: request failed)");
    });
  });
});
