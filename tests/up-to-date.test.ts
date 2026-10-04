// Spec 0007 AC-11: the CI job "Up to date with main" and the script behind it. The decision is a pure function; the git
// side is exercised against a real temporary repository; the workflow's trigger, name and command are pinned as text.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { behindCount, checkUpToDate } from "../scripts/check-up-to-date.mjs";

const read = (file: string) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

describe("spec 0007: Up to date with main", () => {
  describe("AC-11: the decision", () => {
    it("passes when the branch lacks no commit of main", () => {
      const result = checkUpToDate({ base: "origin/main", head: "a".repeat(40), behind: 0 });
      expect(result.ok).toBe(true);
      expect(result.message).toContain("Up to date with origin/main");
    });

    it("fails when it is behind, saying how far and what to do", () => {
      const one = checkUpToDate({ base: "origin/main", head: "a".repeat(40), behind: 1 });
      expect(one.ok).toBe(false);
      expect(one.message).toContain("1 commit behind origin/main");
      const many = checkUpToDate({ base: "origin/main", head: "a".repeat(40), behind: 7 });
      expect(many.ok).toBe(false);
      expect(many.message).toContain("7 commits behind origin/main");
      expect(many.message).toMatch(/git merge origin\/main/);
      expect(many.message).toMatch(/npm run check/);
    });
  });

  describe("AC-11: what git says", () => {
    let dir: string;
    const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const commit = (file: string, content: string, message: string) => {
      fs.writeFileSync(path.join(dir, file), content);
      git("add", "-A");
      git("-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", "commit", "-m", message);
      return git("rev-parse", "HEAD").trim();
    };
    let base: string;
    let topic: string;
    let mainTip: string;

    beforeAll(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), "up-to-date-"));
      git("init", "-q", "-b", "main");
      base = commit("a.txt", "1", "base");
      git("switch", "-q", "-c", "topic");
      topic = commit("b.txt", "1", "topic work");
      git("switch", "-q", "main");
      commit("c.txt", "1", "main moves on");
      mainTip = commit("d.txt", "1", "and again");
    });
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    it("counts the commits of main that the branch lacks", () => {
      expect(behindCount(git, "main", topic)).toBe(2);
      expect(behindCount(git, "main", base)).toBe(2);
    });

    it("counts none once main is merged into the branch, or when the branch is main itself", () => {
      expect(behindCount(git, "main", mainTip)).toBe(0);
      git("switch", "-q", "topic");
      git("-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", "merge", "--no-edit", "main");
      const merged = git("rev-parse", "HEAD").trim();
      expect(behindCount(git, "main", merged)).toBe(0);
    });
  });

  describe("AC-11: the CI job", () => {
    const ci = read(".github/workflows/ci.yml");
    const lines = ci.split("\n");
    const start = lines.findIndex((line) => line === "  up-to-date:");
    const end = lines.findIndex((line, i) => i > start && /^ {2}[a-z]/.test(line));
    const job = lines.slice(start, end === -1 ? undefined : end).join("\n");

    it("is named `Up to date with main`, runs on pull requests only, on a full clone, and runs the script", () => {
      expect(start).toBeGreaterThan(-1);
      expect(job).toContain("name: Up to date with main");
      expect(job).toContain("if: github.event_name == 'pull_request'");
      expect(job).toMatch(/fetch-depth: 0/);
      expect(job).toMatch(/- run: node scripts\/check-up-to-date\.mjs/);
      expect(fs.existsSync(new URL("../scripts/check-up-to-date.mjs", import.meta.url))).toBe(true);
    });

    it("needs no secret and no write permission", () => {
      expect(job).not.toMatch(/secrets\./);
      expect(ci).toMatch(/^permissions:\s*\n\s+contents: read/m);
    });
  });

  describe("AC-11, spec 0021 AC-6: the merge rule is written down", () => {
    const claude = read("CLAUDE.md");

    it("CLAUDE.md names the job among the jobs that must be green, and says to check live and update a branch that is behind", () => {
      expect(claude).toMatch(/"Up to date with main"/);
      expect(claude).toMatch(/git merge-base --is-ancestor origin\/main <full-sha>/);
      expect(claude).toMatch(/merge `origin\/main` into the branch/);
    });
  });
});
