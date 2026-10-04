// Spec 0021 AC-8: what a merge leaves behind (worktrees, branches) is removed, and nothing that could hold work is.
// `planTidy` decides (pure); the end-to-end block runs the real script against a bare origin and a clone.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Real git repositories: slow when the whole suite runs in parallel.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });
import { planTidy, unlinkNodeModules } from "../scripts/tidy.mjs";

const P = "/r";
const wt = (name: string, over: Partial<{ branch: string | null; merged: boolean; clean: boolean }> = {}) => ({
  path: `${P}/.claude/worktrees/${name}`,
  branch: name,
  merged: true,
  clean: true,
  ...over,
});
const state = (over: object = {}) => ({
  primary: P,
  current: `${P}/.claude/worktrees/me`,
  worktrees: [{ path: P, branch: "main", merged: true, clean: true }, wt("me"), wt("done")],
  branches: [{ name: "main", merged: true }, { name: "me", merged: true }, { name: "done", merged: true }],
  remotes: [],
  ...over,
});

describe("spec 0021: tidy after a merge", () => {
  describe("AC-8: planTidy", () => {
    it("removes a clean worktree whose work is in origin/main, and its branch", () => {
      const plan = planTidy(state());
      expect(plan.removeWorktrees.map((w) => w.path)).toEqual([`${P}/.claude/worktrees/done`]);
      expect(plan.deleteBranches).toEqual(["done"]);
    });

    it("keeps the primary checkout, the worktree it runs in, its branch and main", () => {
      const plan = planTidy(state());
      expect(plan.keep.map((k) => k.what)).toEqual(expect.arrayContaining([expect.stringContaining("(/r)"), expect.stringContaining("(/r/.claude/worktrees/me)"), "branch me"]));
      expect(plan.deleteBranches).not.toContain("main");
    });

    it("keeps a worktree with modified or untracked files, and its branch", () => {
      const plan = planTidy(state({ worktrees: [wt("me"), wt("dirty", { clean: false })], branches: [{ name: "dirty", merged: true }] }));
      expect(plan.removeWorktrees).toEqual([]);
      expect(plan.deleteBranches).toEqual([]);
      expect(plan.keep.find((k) => k.what.includes("dirty"))?.why).toMatch(/modified or untracked/);
    });

    it("keeps a worktree and a branch with commits that origin/main does not have", () => {
      const plan = planTidy(state({ worktrees: [wt("me"), wt("open", { merged: false })], branches: [{ name: "open", merged: false }, { name: "lone", merged: false }] }));
      expect(plan.removeWorktrees).toEqual([]);
      expect(plan.deleteBranches).toEqual([]);
      expect(plan.keep.map((k) => k.why).filter((w) => /commits that origin\/main does not have/.test(w))).toHaveLength(3);
    });

    it("removes a detached merged worktree and keeps a merged branch that a kept worktree has checked out", () => {
      const plan = planTidy(state({ worktrees: [wt("me"), wt("old", { branch: null }), wt("busy", { clean: false })], branches: [{ name: "busy", merged: true }] }));
      expect(plan.removeWorktrees.map((w) => w.path)).toEqual([`${P}/.claude/worktrees/old`]);
      expect(plan.keep.find((k) => k.what === "branch busy")?.why).toMatch(/checked out in/);
    });

    it("never touches a worktree outside .claude/worktrees (another tool's)", () => {
      const plan = planTidy(state({ worktrees: [wt("me"), { path: "/elsewhere/agent", branch: "agent", merged: true, clean: true }] }));
      expect(plan.removeWorktrees).toEqual([]);
      expect(plan.keep.find((k) => k.what.includes("/elsewhere/agent"))?.why).toMatch(/another tool/);
    });

    it("deletes merged remote branches (only on request, in the CLI) and keeps unmerged ones and main", () => {
      const plan = planTidy(state({ remotes: [{ name: "gone", merged: true }, { name: "wip", merged: false }, { name: "main", merged: true }] }));
      expect(plan.deleteRemote).toEqual(["gone"]);
      expect(plan.keep.map((k) => k.what)).toContain("origin/wip");
    });
  });

  it("AC-9: a local main that is only behind origin/main is moved up, unless a worktree has it checked out", () => {
    expect(planTidy(state({ localMain: { behind: true }, worktrees: [wt("me")] })).advanceMain).toBe(true);
    expect(planTidy(state({ localMain: { behind: false } })).advanceMain).toBe(false);
    expect(planTidy(state({ localMain: null })).advanceMain).toBe(false);
    const held = planTidy(state({ localMain: { behind: true } })); // the primary checkout has main
    expect(held.advanceMain).toBe(false);
    expect(held.keep.find((k) => k.what.startsWith("branch main"))?.why).toMatch(/checked out in/);
  });

  it("AC-8: unlinking node_modules leaves what the junction points at alone", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tidy-nm-"));
    try {
      const real = path.join(dir, "real-node-modules");
      fs.mkdirSync(real);
      fs.writeFileSync(path.join(real, "keep.txt"), "x");
      const worktree = path.join(dir, "wt");
      fs.mkdirSync(worktree);
      fs.symlinkSync(real, path.join(worktree, "node_modules"), "junction");
      expect(unlinkNodeModules(worktree)).toBe(true);
      expect(fs.existsSync(path.join(worktree, "node_modules"))).toBe(false);
      expect(fs.readFileSync(path.join(real, "keep.txt"), "utf8")).toBe("x");
      expect(unlinkNodeModules(worktree)).toBe(false); // nothing left to unlink
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  describe("AC-8: the script, against a bare origin and a clone", () => {
    let root: string;
    let primary: string;
    const SCRIPT = path.resolve(new URL("../scripts/tidy.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
    const git = (cwd: string, ...args: string[]) => {
      const r = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd, encoding: "utf8" });
      if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
      return r.stdout.trim();
    };
    const tidy = (cwd: string, ...args: string[]) => spawnSync("node", [SCRIPT, ...args], { cwd, encoding: "utf8" });
    const wtDir = (name: string) => path.join(primary, ".claude", "worktrees", name);

    beforeAll(() => {
      root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "tidy-")));
      const origin = path.join(root, "origin.git");
      git(root, "init", "-q", "--bare", "-b", "main", origin);
      primary = path.join(root, "primary");
      git(root, "clone", "-q", origin, primary);
      git(primary, "checkout", "-q", "-b", "main");
      fs.writeFileSync(path.join(primary, ".gitignore"), ".claude/\n");
      fs.writeFileSync(path.join(primary, "a.txt"), "a\n");
      git(primary, "add", ".");
      git(primary, "commit", "-q", "-m", "init");
      git(primary, "push", "-q", "-u", "origin", "main");

      for (const name of ["done", "dirty", "open", "me"]) git(primary, "worktree", "add", "-q", "-b", name, wtDir(name), "origin/main");
      // `done` is merged through a merge commit, as a pull request is; `me` and `dirty` have no commits of their own.
      fs.writeFileSync(path.join(wtDir("done"), "d.txt"), "d\n");
      git(wtDir("done"), "add", ".");
      git(wtDir("done"), "commit", "-q", "-m", "done work");
      git(primary, "merge", "-q", "--no-ff", "-m", "Merge done", "done");
      git(primary, "push", "-q", "origin", "main");
      fs.writeFileSync(path.join(wtDir("dirty"), "scratch.txt"), "wip\n");
      fs.writeFileSync(path.join(wtDir("open"), "o.txt"), "o\n");
      git(wtDir("open"), "add", ".");
      git(wtDir("open"), "commit", "-q", "-m", "not merged");
    });
    afterAll(() => {
      spawnSync("git", ["worktree", "prune"], { cwd: primary });
      fs.rmSync(root, { recursive: true, force: true });
    });

    it("a dry run lists what it would do and changes nothing", () => {
      const run = tidy(wtDir("me"));
      expect(run.status).toBe(0);
      expect(run.stdout).toMatch(/Would remove worktree .*done/);
      expect(run.stdout).toMatch(/Would delete local branch done/);
      expect(run.stdout).toMatch(/Dry run: nothing was changed/);
      expect(fs.existsSync(wtDir("done"))).toBe(true);
    });

    it("--apply removes the merged worktree and branch and keeps the rest, saying why", () => {
      const run = tidy(wtDir("me"), "--apply");
      expect(run.status, run.stderr).toBe(0);
      expect(fs.existsSync(wtDir("done"))).toBe(false);
      expect(git(primary, "branch", "--list", "done")).toBe("");
      for (const kept of ["dirty", "open", "me"]) expect(fs.existsSync(wtDir(kept)), kept).toBe(true);
      expect(git(primary, "branch", "--list", "open")).not.toBe("");
      expect(run.stdout).toMatch(/Keeping worktree dirty .*modified or untracked/);
      expect(run.stdout).toMatch(/Keeping worktree open .*commits that origin\/main does not have/);
      expect(run.stdout).toMatch(/Keeping worktree me .*this runs in/);
    });

    it("AC-9: a stale local main is fast-forwarded when no worktree has it", () => {
      // A second clone that sits on another branch while origin/main moves on, as the shared checkout does.
      const clone = path.join(root, "second");
      git(root, "clone", "-q", path.join(root, "origin.git"), clone);
      git(clone, "checkout", "-q", "-b", "work");
      fs.writeFileSync(path.join(primary, "later.txt"), "x\n");
      git(primary, "add", ".");
      git(primary, "commit", "-q", "-m", "later");
      git(primary, "push", "-q", "origin", "main");
      const before = git(clone, "rev-parse", "main");
      const dry = tidy(clone);
      expect(dry.stdout).toMatch(/Would move local main up to origin\/main/);
      expect(git(clone, "rev-parse", "main")).toBe(before);
      const run = tidy(clone, "--apply");
      expect(run.status, run.stderr).toBe(0);
      expect(git(clone, "rev-parse", "main")).toBe(git(clone, "rev-parse", "origin/main"));
      expect(git(clone, "rev-parse", "main")).not.toBe(before);
    });

    it("an unknown argument fails with the usage", () => {
      const run = tidy(wtDir("me"), "--force");
      expect(run.status).toBe(1);
      expect(run.stderr).toMatch(/Usage: node scripts\/tidy.mjs/);
    });
  });
});
