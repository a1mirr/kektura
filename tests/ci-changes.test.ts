import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { changedFiles, codeChanged } from "../scripts/ci-changes.mjs";

// Its git tests spawn several processes each, and the unit tests run in dozens of workers at once: the default 5 s and 10 s
// (a test and a hook) were missed under load, while the same file passes alone in about a second.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

const script = new URL("../scripts/ci-changes.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const pr = (files: string[] | null) => codeChanged({ eventName: "pull_request", files });

describe("spec 0007: which changes run the end-to-end job", () => {
  describe("AC-10: the decision", () => {
    it("a pull request that changes only Markdown, anywhere in the tree, needs no end-to-end run", () => {
      expect(pr(["README.md"])).toBe(false);
      expect(pr(["specs/project/0007-ci.md", ".github/ISSUE_TEMPLATE/task.md", "CLAUDE.md", ".github/pull_request_template.md", ".claude/agents/fresh-reviewer.md"])).toBe(false);
    });

    it("any other file makes it run: code, messages, workflows, migrations, scripts, tests, lockfile, MDX and lookalikes", () => {
      for (const file of ["src/app/page.tsx", "messages/en.json", ".github/workflows/ci.yml", "supabase/migrations/0054_x.sql", "scripts/ci-changes.mjs", "tests/a.test.ts", "package-lock.json", "page.mdx", "notes.md.ts", "md", "LICENSE"]) {
        expect(pr(["README.md", file]), file).toBe(true);
      }
    });

    it("a mix of Markdown and one code file runs everything", () => {
      expect(pr(["specs/project/0007-ci.md", "src/lib/progress.ts", "specs/project/0034-specs-and-tasks.md"])).toBe(true);
    });

    it("an empty or unreadable list runs everything: running too much is the safe mistake", () => {
      expect(pr([])).toBe(true);
      expect(pr(null)).toBe(true);
    });

    it("a push (to main) and any other event run everything, whatever the files", () => {
      expect(codeChanged({ eventName: "push", files: ["README.md"] })).toBe(true);
      expect(codeChanged({ eventName: "push", files: null })).toBe(true);
      expect(codeChanged({ eventName: "workflow_dispatch", files: ["README.md"] })).toBe(true);
      expect(codeChanged({ eventName: "", files: ["README.md"] })).toBe(true);
    });
  });

  describe("AC-10: the changed files, from a real repository", () => {
    let dir: string;
    const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const commit = (files: Record<string, string>, message: string) => {
      for (const [name, content] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
        fs.writeFileSync(path.join(dir, name), content);
      }
      git("add", "-A");
      git("-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", "commit", "-m", message);
    };
    const mergeOf = (topic: string) => {
      git("switch", "-q", "-C", "merge-ref", "main");
      git("-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", "merge", "--no-ff", "-q", "-m", "merge", topic);
    };

    beforeAll(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), "ci-changes-"));
      git("init", "-q", "-b", "main");
      commit({ "src/a.ts": "1", "README.md": "1", "docs/y.md": "1" }, "base");
    });
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    it("lists what the branch changed, not what the base gained since the branch was cut", () => {
      git("switch", "-q", "-c", "docs-only", "main");
      commit({ "README.md": "2", "specs/x.md": "1" }, "docs");
      git("switch", "-q", "main");
      commit({ "src/a.ts": "2" }, "main moves on");
      mergeOf("docs-only");
      expect(changedFiles(git)?.sort()).toEqual(["README.md", "specs/x.md"]);
      expect(pr(changedFiles(git))).toBe(false);
      const output = path.join(os.tmpdir(), `ci-changes-output-${path.basename(dir)}`);
      try {
        execFileSync("node", [script], { cwd: dir, encoding: "utf8", env: { ...process.env, GITHUB_EVENT_NAME: "pull_request", GITHUB_OUTPUT: output } });
        expect(fs.readFileSync(output, "utf8")).toBe("code_changed=false\n");
      } finally {
        fs.rmSync(output, { force: true });
      }
      git("switch", "-q", "main");
    });

    it("a branch that also changes code runs everything", () => {
      git("switch", "-q", "-c", "with-code", "main");
      commit({ "README.md": "3", "src/b.ts": "1" }, "docs and code");
      git("switch", "-q", "main");
      mergeOf("with-code");
      expect(changedFiles(git)?.sort()).toEqual(["README.md", "src/b.ts"]);
      expect(pr(changedFiles(git))).toBe(true);
      git("switch", "-q", "main");
    });

    it("lists both paths when a Markdown file became code", () => {
      git("switch", "-q", "-c", "renamed", "main");
      git("mv", "docs/y.md", "docs/y.ts");
      commit({}, "rename");
      git("switch", "-q", "main");
      mergeOf("renamed");
      expect(changedFiles(git)?.sort()).toEqual(["docs/y.md", "docs/y.ts"]);
      expect(pr(changedFiles(git))).toBe(true);
      git("switch", "-q", "main");
    });

    it("answers null when HEAD is not a merge commit (a plain checkout), so the caller runs everything", () => {
      git("switch", "-q", "main");
      expect(changedFiles(git)).toBeNull();
    });

    it("answers null when git fails (not a repository)", () => {
      const nowhere = fs.mkdtempSync(path.join(os.tmpdir(), "ci-changes-none-"));
      try {
        const inNowhere = (...args: string[]) => execFileSync("git", args, { cwd: nowhere, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(nowhere) } });
        expect(changedFiles(inNowhere)).toBeNull();
      } finally {
        fs.rmSync(nowhere, { recursive: true, force: true });
      }
    });
  });

  describe("AC-10: the script, run the way the workflow runs it", () => {
    let dir: string;
    beforeAll(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), "ci-changes-out-"));
    });
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    it("writes code_changed=true for a push, to the file named by GITHUB_OUTPUT", () => {
      const output = path.join(dir, "output");
      const printed = execFileSync("node", [script], { cwd: dir, encoding: "utf8", env: { ...process.env, GITHUB_EVENT_NAME: "push", GITHUB_OUTPUT: output } });
      expect(fs.readFileSync(output, "utf8")).toBe("code_changed=true\n");
      expect(printed).toContain("code_changed=true");
    });

    it("writes code_changed=true for a pull request whose files cannot be listed (a directory that is no repository)", () => {
      const output = path.join(dir, "output-pr");
      execFileSync("node", [script], { cwd: dir, encoding: "utf8", env: { ...process.env, GITHUB_EVENT_NAME: "pull_request", GITHUB_OUTPUT: output, GIT_CEILING_DIRECTORIES: path.dirname(dir) } });
      expect(fs.readFileSync(output, "utf8")).toBe("code_changed=true\n");
    });
  });
});
