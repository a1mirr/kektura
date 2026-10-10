// Run against real temporary repositories (a primary checkout and linked worktrees), because "primary or linked" is
// what git says, not a path.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });
import { decide, gitInvocation, toNative } from "../.claude/hooks/worktree-guard.mjs";

const read = (file: string) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const git = (cwd: string, ...args: string[]) => {
  const result = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
};

let root: string;
let primary: string;
let topic: string;
let onMain: string;
let other: string;

beforeAll(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "worktree-guard-")));
  primary = path.join(root, "primary");
  fs.mkdirSync(primary);
  git(primary, "init", "-q", "-b", "base");
  fs.writeFileSync(path.join(primary, ".gitignore"), ".next/\n.env.local\n");
  fs.writeFileSync(path.join(primary, "a.txt"), "a\n");
  git(primary, "add", ".");
  git(primary, "commit", "-q", "-m", "init");
  git(primary, "branch", "main");
  topic = path.join(root, "wt-topic");
  onMain = path.join(root, "wt-main");
  git(primary, "worktree", "add", "-q", "-b", "topic", topic);
  git(primary, "worktree", "add", "-q", onMain, "main");
  other = path.join(root, "other");
  fs.mkdirSync(other);
  git(other, "init", "-q", "-b", "main");
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

const file = (tool: string, target: string, cwd: string) => ({ tool_name: tool, tool_input: { file_path: target }, cwd });
const bash = (command: string, cwd: string) => ({ tool_name: "Bash", tool_input: { command }, cwd });

describe("spec 0021: work happens in a linked worktree", () => {
  describe("AC-7: Edit, Write and NotebookEdit", () => {
    it.each(["Edit", "Write", "NotebookEdit"])("%s in the primary checkout is refused, with the way to make a worktree", (tool) => {
      const message = decide(file(tool, path.join(primary, "a.txt"), topic), { project: topic });
      expect(message).toMatch(/primary checkout/);
      expect(message).toContain("git worktree add .claude/worktrees/<name> -b <topic> origin/main");
    });

    it("a new file in a directory that does not exist yet in the primary checkout is refused too", () => {
      expect(decide(file("Write", path.join(primary, "new", "deep", "b.txt"), topic), { project: topic })).toMatch(/primary checkout/);
    });

    it("a file in a linked worktree on a topic branch is allowed", () => {
      expect(decide(file("Edit", path.join(topic, "a.txt"), topic), { project: topic })).toBe("");
      expect(decide(file("Write", path.join(topic, "x", "y.txt"), topic), { project: topic })).toBe("");
    });

    it("a linked worktree that is on main is refused", () => {
      expect(decide(file("Edit", path.join(onMain, "a.txt"), topic), { project: topic })).toMatch(/is on main/);
    });

    it("a relative path is resolved against the session's directory", () => {
      expect(decide(file("Edit", "a.txt", primary), { project: topic })).toMatch(/primary checkout/);
      expect(decide(file("Edit", "a.txt", topic), { project: topic })).toBe("");
    });

    it("an ignored file (build output, .env.local) in the primary checkout is allowed", () => {
      expect(decide(file("Write", path.join(primary, ".env.local"), topic), { project: topic })).toBe("");
      expect(decide(file("Write", path.join(primary, ".next", "cache.json"), topic), { project: topic })).toBe("");
    });

    it("a file outside the repository, or in another repository, is not this hook's business", () => {
      expect(decide(file("Write", path.join(root, "notes.md"), topic), { project: topic })).toBe("");
      expect(decide(file("Write", path.join(other, "a.txt"), topic), { project: topic })).toBe("");
    });

    it("outside a git checkout nothing is guarded", () => {
      expect(decide(file("Write", path.join(root, "x.md"), root), { project: root })).toBe("");
    });
  });

  describe("AC-7: git commands that change a checkout", () => {
    it.each(["git commit -m x", "git switch topic", "git checkout -b t", "git merge origin/main", "git pull", "git reset --hard", "git add -A", "git stash"])(
      "`%s` in the primary checkout is refused",
      (command) => {
        expect(decide(bash(command, primary), { project: topic })).toMatch(/primary checkout/);
      },
    );

    it("the same commands in a linked worktree on a topic branch are allowed", () => {
      for (const command of ["git commit -m x", "git switch --detach origin/main", "git merge origin/main", "git add -A"]) {
        expect(decide(bash(command, topic), { project: topic }), command).toBe("");
      }
    });

    it("`git -C <dir>` and a leading `cd <dir> &&` decide which checkout is meant", () => {
      expect(decide(bash(`git -C "${primary}" commit -m x`, topic), { project: topic })).toMatch(/primary checkout/);
      expect(decide(bash(`cd "${primary}" && git commit -m x`, topic), { project: topic })).toMatch(/primary checkout/);
      expect(decide(bash(`cd "${topic}" && git commit -m x`, primary), { project: topic })).toBe("");
      expect(decide(bash(`git -C "${topic}" commit -m x`, primary), { project: topic })).toBe("");
    });

    it("a git command in the middle of a pipeline or after a semicolon is found", () => {
      expect(decide(bash("echo hi; git commit -m x", primary), { project: topic })).toMatch(/primary checkout/);
      expect(decide(bash("npm run check && git add -A", primary), { project: topic })).toMatch(/primary checkout/);
    });

    it("a linked worktree that is on main is refused", () => {
      expect(decide(bash("git commit -m x", onMain), { project: topic })).toMatch(/is on main/);
    });

    it.each(["git status", "git log --oneline", "git diff", "git fetch origin", "git worktree add ../x -b t origin/main", "git branch -r", "git push -u origin topic", "npm test", "ls"])(
      "reading, fetching, making a worktree and pushing are allowed in the primary checkout: `%s`",
      (command) => {
        expect(decide(bash(command, primary), { project: topic })).toBe("");
      },
    );

    it("reading the stash is a read; changing it is not", () => {
      expect(decide(bash("git stash list", primary), { project: topic })).toBe("");
      expect(decide(bash("git stash show -p", primary), { project: topic })).toBe("");
      expect(decide(bash("git stash push -m x", primary), { project: topic })).toMatch(/primary checkout/);
      expect(decide(bash("git stash pop", primary), { project: topic })).toMatch(/primary checkout/);
    });

    it("another tool is never refused", () => {
      expect(decide({ tool_name: "Read", tool_input: { file_path: path.join(primary, "a.txt") }, cwd: primary }, { project: topic })).toBe("");
    });
  });

  describe("AC-7: spellings of the same command", () => {
    it("toNative turns Git Bash and WSL drive paths into Windows paths and leaves the rest alone", () => {
      expect(toNative("/c/Personal/kektura", "win32")).toBe("C:\\Personal\\kektura");
      expect(toNative("/mnt/d/x/y", "win32")).toBe("D:\\x\\y");
      expect(toNative("/c", "win32")).toBe("C:\\");
      expect(toNative("/usr/bin", "win32")).toBe("/usr/bin");
      expect(toNative("/c/Personal", "linux")).toBe("/c/Personal");
      expect(toNative("~/x")).toBe(path.join(os.homedir(), "x"));
    });

    it.runIf(process.platform === "win32")("a Git Bash path in `cd` or `git -C` still points at the primary checkout", () => {
      const posix = primary.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_m, d: string) => `/${d.toLowerCase()}`);
      expect(decide(bash(`cd ${posix} && git commit -m x`, topic), { project: topic })).toMatch(/primary checkout/);
      expect(decide(bash(`git -C ${posix} checkout -b y`, topic), { project: topic })).toMatch(/primary checkout/);
    });

    it.each(["FOO=1 git commit -m x", "GIT_AUTHOR_NAME=a GIT_AUTHOR_EMAIL=b git commit -m x", "command git commit -m x", "git.exe commit -m x", '"git" commit -m x'])(
      "`%s` is git too",
      (command) => {
        expect(decide(bash(command, primary), { project: topic })).toMatch(/primary checkout/);
      },
    );

    it("the PowerShell tool is guarded like Bash, with Set-Location and `;` in place of cd and &&", () => {
      const ps = (command: string, cwd: string) => ({ tool_name: "PowerShell", tool_input: { command }, cwd });
      expect(decide(ps("git commit -m x", primary), { project: topic })).toMatch(/primary checkout/);
      expect(decide(ps(`Set-Location "${primary}"; git add -A`, topic), { project: topic })).toMatch(/primary checkout/);
      expect(decide(ps(`Set-Location -Path "${primary}"; git switch x`, topic), { project: topic })).toMatch(/primary checkout/);
      expect(decide(ps(`git -C "${primary}" reset --hard`, topic), { project: topic })).toMatch(/primary checkout/);
      expect(decide(ps("git commit -m x", topic), { project: topic })).toBe("");
      expect(decide(ps("Get-ChildItem", primary), { project: topic })).toBe("");
    });

    it('a quoted value with a space in an env prefix is one word: FOO="a b" git commit', () => {
      expect(decide(bash('FOO="a b" git commit -m x', primary), { project: topic })).toMatch(/primary checkout/);
    });

    it("a forward-only update of a checkout that is on main is upkeep and is allowed; any other merge or pull there is not", () => {
      for (const command of ["git merge --ff-only origin/main", "git pull --ff-only origin main", "git pull --ff-only"]) {
        expect(decide(bash(command, onMain), { project: topic }), command).toBe("");
      }
      expect(decide(bash("git merge origin/main", onMain), { project: topic })).toMatch(/is on main/);
      expect(decide(bash("git pull", onMain), { project: topic })).toMatch(/is on main/);
      expect(decide(bash("git merge --ff-only origin/main", primary), { project: topic })).toMatch(/primary checkout/);
    });
  });

  it("gitInvocation reads the subcommand past git's own options", () => {
    expect(gitInvocation("git -c core.quotepath=false -C sub commit -m x", "/r")?.subcommand).toBe("commit");
    expect(gitInvocation("git --no-pager log", "/r")?.subcommand).toBe("log");
    expect(gitInvocation("npm test", "/r")).toBeNull();
  });

  it("AC-8, AC-9, AC-10: CLAUDE.md tells the author to work in a worktree from a fresh origin/main, to tidy after a merge, and what a denied call means", () => {
    const claude = read("CLAUDE.md");
    expect(claude).toMatch(/Always work in your own worktree, never in the primary checkout and never on `main`/);
    expect(claude).toMatch(/`git fetch origin` as a call of its own, then `git worktree add \.claude\/worktrees\/<name> -b <topic> origin\/main`/);
    expect(claude).toMatch(/`npm run tidy -- --apply` does it/);
    expect(claude).toMatch(/It keeps the worktree it runs in/);
    expect(claude).toMatch(/denies is not retried, split or routed around, and it is not a place to stop/);
    expect(claude).toMatch(/give the user the denied command \(in its own `bash` block\) in the final message/);
    expect(claude).toMatch(/never chained with reads, so a denial cannot swallow the rest/);
  });

  describe("AC-7: wiring", () => {
    it("the hook runs before Edit, Write, NotebookEdit and Bash, and a payload it cannot read does not block", () => {
      const settings = JSON.parse(read(".claude/settings.json"));
      const entry = settings.hooks.PreToolUse.find((h: { hooks: { command: string }[] }) => h.hooks.some((x) => x.command.includes("worktree-guard.mjs")));
      expect(entry.matcher).toBe("Edit|Write|NotebookEdit|Bash|PowerShell");
      expect(settings.worktree.baseRef).toBe("fresh");
      const script = path.resolve(new URL("../.claude/hooks/worktree-guard.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
      const run = spawnSync("node", [script], { input: "not json", encoding: "utf8" });
      expect(run.status).toBe(0);
    });

    it("run as the hook it exits 2 and prints the way out when the call is refused", () => {
      const script = path.resolve(new URL("../.claude/hooks/worktree-guard.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
      const run = spawnSync("node", [script], {
        input: JSON.stringify(file("Edit", path.join(primary, "a.txt"), primary)),
        encoding: "utf8",
        env: { ...process.env, CLAUDE_PROJECT_DIR: primary },
      });
      expect(run.status).toBe(2);
      expect(run.stderr).toContain("git worktree add");
    });
  });
});

describe("spec 0021: AC-9 a new branch starts from a fresh origin/main", () => {
  let base: string;
  let clone: string;
  let elsewhere: string; // someone else's clone, to move origin/main behind this one's back
  const create = (command: string) => decide(bash(command, clone), { project: clone });

  beforeAll(() => {
    base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "worktree-guard-origin-")));
    const origin = path.join(base, "origin.git");
    git(base, "init", "-q", "--bare", "-b", "main", origin);
    clone = path.join(base, "clone");
    git(base, "clone", "-q", origin, clone);
    git(clone, "checkout", "-q", "-b", "main");
    fs.writeFileSync(path.join(clone, "a.txt"), "a\n");
    git(clone, "add", ".");
    git(clone, "commit", "-q", "-m", "init");
    git(clone, "push", "-q", "-u", "origin", "main");
    git(clone, "branch", "existing");
    elsewhere = path.join(base, "elsewhere");
    git(base, "clone", "-q", origin, elsewhere);
  });
  afterAll(() => fs.rmSync(base, { recursive: true, force: true }));

  it("a new branch from the current origin/main is allowed", () => {
    expect(create("git worktree add .claude/worktrees/x -b topic origin/main")).toBe("");
    expect(create("git worktree add -B topic .claude/worktrees/x origin/main")).toBe("");
  });

  it.each([
    ["a local main", "git worktree add .claude/worktrees/x -b topic main"],
    ["another branch", "git worktree add .claude/worktrees/x -b topic existing"],
    ["no base at all (wherever HEAD is)", "git worktree add .claude/worktrees/x -b topic"],
  ])("a new branch from %s is refused", (_what, command) => {
    expect(create(command)).toMatch(/starts from origin\/main/);
  });

  it("an origin/main that is behind GitHub's main is refused until it is fetched", () => {
    fs.writeFileSync(path.join(elsewhere, "b.txt"), "b\n");
    git(elsewhere, "add", ".");
    git(elsewhere, "commit", "-q", "-m", "someone merged a pull request");
    git(elsewhere, "push", "-q", "origin", "main");
    const stale = create("git worktree add .claude/worktrees/x -b topic origin/main");
    expect(stale).toMatch(/GitHub's main is [0-9a-f]{7}: run `git fetch origin` first/);
    git(clone, "fetch", "-q", "origin");
    expect(create("git worktree add .claude/worktrees/x -b topic origin/main")).toBe("");
  });

  it("the attached form -bNAME starts a new branch too and has to start from origin/main", () => {
    expect(create("git worktree add .claude/worktrees/x -btopic main")).toMatch(/starts from origin\/main/);
    expect(create("git worktree add .claude/worktrees/x -btopic origin/main")).toBe("");
  });

  it("`git worktree add <path>` alone makes a branch from HEAD, so it is a new branch with no base and is refused; --detach is not", () => {
    expect(create("git worktree add .claude/worktrees/x")).toMatch(/starts from origin\/main/);
    expect(create("git worktree add --detach .claude/worktrees/x origin/main")).toBe("");
    expect(create("git worktree add --detach .claude/worktrees/x")).toBe("");
  });

  it("checking out an existing branch (no -b) is not a new branch and is allowed", () => {
    expect(create("git worktree add .claude/worktrees/x existing")).toBe("");
  });

  it("a command that chains the fetch first is judged on the state before it runs, so the fetch has to be its own call", () => {
    fs.writeFileSync(path.join(elsewhere, "c.txt"), "c\n");
    git(elsewhere, "add", ".");
    git(elsewhere, "commit", "-q", "-m", "another merge");
    git(elsewhere, "push", "-q", "origin", "main");
    expect(create("git fetch origin && git worktree add .claude/worktrees/x -b topic origin/main")).toMatch(/run `git fetch origin` first/);
  });

  it("without a reachable origin there is nothing to compare with, and origin/main as base passes", () => {
    expect(decide(bash("git worktree add .claude/worktrees/x -b topic origin/main", primary), { project: topic })).toBe("");
  });
});
