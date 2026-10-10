// Its required checks are the jobs the CI workflow really has (a job that is renamed would otherwise leave every pull
// request waiting for a check that never comes).
import fs from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const ruleset = JSON.parse(read(".github/rulesets/protect-main.json"));
const ci = read(".github/workflows/ci.yml");
const rule = (type: string) => ruleset.rules.find((r: { type: string }) => r.type === type);

describe("spec 0021: the ruleset on main", () => {
  it("AC-11: is active on the default branch, with nobody allowed to bypass it", () => {
    expect(ruleset.target).toBe("branch");
    expect(ruleset.enforcement).toBe("active");
    expect(ruleset.conditions.ref_name.include).toEqual(["~DEFAULT_BRANCH"]);
    expect(ruleset.conditions.ref_name.exclude).toEqual([]);
    expect(ruleset.bypass_actors).toEqual([]);
  });

  it("AC-11: forbids deleting and force-pushing, and requires a pull request merged with a merge commit", () => {
    expect(rule("deletion")).toBeDefined();
    expect(rule("non_fast_forward")).toBeDefined();
    expect(rule("pull_request").parameters.allowed_merge_methods).toEqual(["merge"]);
    expect(rule("pull_request").parameters.required_approving_review_count).toBe(0);
  });

  it("AC-11: requires branches to be up to date with main", () => {
    expect(rule("required_status_checks").parameters.strict_required_status_checks_policy).toBe(true);
  });

  it("AC-11: the required checks are exactly the jobs of ci.yml", () => {
    const jobs = ci.slice(ci.indexOf("\njobs:"));
    const names = [...jobs.matchAll(/^ {4}name: (.+)$/gm)].map((m) => m[1].trim());
    expect(names.length).toBeGreaterThanOrEqual(3);
    const required = rule("required_status_checks").parameters.required_status_checks.map((c: { context: string }) => c.context);
    expect([...required].sort()).toEqual([...names].sort());
  });
});
