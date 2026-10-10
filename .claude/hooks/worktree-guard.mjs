import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PROTECTED_BRANCHES = ["main", "master"];
export const MUTATING = new Set([
  "add", "am", "apply", "checkout", "cherry-pick", "clean", "commit", "merge", "mv", "pull", "rebase", "reset", "restore", "revert", "rm", "stash", "switch",
]);
const FILE_TOOLS = new Set(["Edit", "Write", "NotebookEdit"]);

export function realGit(dir, args) {
  const result = spawnSync("git", ["-c", "core.quotepath=false", ...args], { cwd: dir, encoding: "utf8", timeout: 10_000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  return { status: result.status ?? 1, stdout: result.stdout ?? "" };
}

export function inspect(dir, git = realGit) {
  const revs = git(dir, ["rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir", "--show-toplevel"]);
  if (revs.status !== 0) return null;
  const [gitDir, commonDir, top] = revs.stdout.split(/\r?\n/);
  const branch = git(dir, ["symbolic-ref", "--short", "-q", "HEAD"]);
  return { commonDir: norm(commonDir), top: norm(top), primary: norm(gitDir) === norm(commonDir), branch: branch.status === 0 ? branch.stdout.trim() : "" };
}

const norm = (p) => path.resolve(p ?? "").replace(/\\/g, "/").toLowerCase();

function refusal(where) {
  if (where.primary) return `${where.top} is the primary checkout, which every session shares`;
  if (PROTECTED_BRANCHES.includes(where.branch)) return `${where.top} is on ${where.branch}`;
  return "";
}

const HOW = [
  "Make the change in your own worktree on a topic branch, always from a fresh origin/main (spec 0021, CLAUDE.md step 5):",
  "  git fetch origin",
  "  git worktree add .claude/worktrees/<name> -b <topic> origin/main",
  "then work there (the EnterWorktree tool switches the session; a junction to node_modules is enough:",
  "  cmd /c mklink /J .claude\\worktrees\\<name>\\node_modules node_modules).",
].join("\n");

function nearestExisting(file) {
  let dir = path.dirname(file);
  while (!fs.existsSync(dir)) {
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return dir;
}

function simpleCommands(line) {
  return line.split(/&&|\|\||;|\||\r?\n/).map((s) => s.trim()).filter(Boolean);
}
const unquote = (s) => s.replace(/^["']|["']$/g, "");
const words = (command) => [...command.matchAll(/(?:"[^"]*"|'[^']*'|[^\s"'])+/g)].map((m) => m[0]);

/** Git Bash and WSL write C:\x as /c/x or /mnt/c/x, and ~ is the home directory; Node on Windows reads neither the way the shell meant it. */
export function toNative(p, platform = process.platform) {
  if (p === "~" || p.startsWith("~/")) return path.join(os.homedir(), p.slice(1));
  if (platform !== "win32") return p;
  const m = /^\/(?:mnt\/)?([a-zA-Z])(?:\/(.*))?$/.exec(p);
  return m ? `${m[1].toUpperCase()}:\\${(m[2] ?? "").replace(/\//g, "\\")}` : p;
}
const resolveFrom = (dir, p) => path.resolve(dir, toNative(unquote(p)));

export function gitInvocation(command, dir) {
  const parts = words(command);
  while (parts.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(parts[0]) || parts[0] === "command")) parts.shift();
  if (!/^(?:.*[\\/])?git(?:\.exe)?$/i.test(unquote(parts[0] ?? ""))) return null;
  parts[0] = "git";
  let where = dir;
  let i = 1;
  while (i < parts.length && parts[i].startsWith("-")) {
    if (parts[i] === "-C" && parts[i + 1]) where = resolveFrom(where, parts[i + 1]);
    i += parts[i] === "-C" || parts[i] === "-c" ? 2 : 1;
  }
  return { subcommand: parts[i] ?? "", where, rest: parts.slice(i + 1) };
}

export function newBranchBase(invocation) {
  if (invocation.subcommand !== "worktree" || invocation.rest[0] !== "add") return null;
  let creates = false;
  const positional = [];
  for (let i = 1; i < invocation.rest.length; i++) {
    const word = invocation.rest[i];
    if (word === "-b" || word === "-B") {
      creates = true;
      i++;
    } else if (/^-[bB]./.test(word)) creates = true;
    else if (word === "--reason") i++;
    else if (!word.startsWith("-")) positional.push(unquote(word));
  }
  if (creates) return { base: positional[1] ?? "" };
  // `git worktree add <path>` alone makes a branch named after the folder, from wherever HEAD is.
  if (positional.length === 1 && !invocation.rest.includes("--detach")) return { base: "" };
  return null;
}

function staleBase(base, where, git) {
  if (base !== "origin/main") {
    return `a new branch starts from origin/main, not ${base ? `"${base}"` : "from wherever HEAD is"}: a local main or a branch can be days behind`;
  }
  const remote = git(where, ["ls-remote", "--heads", "origin", "refs/heads/main"]);
  const remoteSha = remote.status === 0 ? remote.stdout.trim().split(/\s+/)[0] : "";
  if (!remoteSha) return "";
  const local = git(where, ["rev-parse", "--verify", "-q", "refs/remotes/origin/main"]).stdout.trim();
  if (local === remoteSha) return "";
  return `origin/main here is ${local.slice(0, 7) || "missing"} but GitHub's main is ${remoteSha.slice(0, 7)}: run \`git fetch origin\` first`;
}

/**
 * @param {{ tool_name?: string, tool_input?: Record<string, unknown>, cwd?: string }} input the hook's stdin
 * @param {{ project?: string, git?: typeof realGit }} [options] `project`: the session's project dir; only that repository is guarded
 * @returns {string} the message for Claude when the call must be refused, "" when it may go on
 */
export function decide(input, { project = input.cwd ?? process.cwd(), git = realGit } = {}) {
  const cwd = input.cwd ?? project;
  const mine = inspect(project, git);
  if (!mine) return "";

  const refuse = (what, reason) => `Blocked: ${what}, but ${reason}. Changes are made in a linked worktree, not here.\n${HOW}`;

  if (FILE_TOOLS.has(input.tool_name ?? "")) {
    const target = String(input.tool_input?.file_path ?? input.tool_input?.notebook_path ?? "");
    if (!target) return "";
    const file = resolveFrom(cwd, target);
    const dir = nearestExisting(file);
    const where = dir && inspect(dir, git);
    if (!where || where.commonDir !== mine.commonDir) return "";
    const reason = refusal(where);
    if (!reason) return "";
    if (git(dir, ["check-ignore", "-q", file]).status === 0) return "";
    return refuse(`${input.tool_name} on ${path.relative(where.top, file).replace(/\\/g, "/")}`, reason);
  }

  if (input.tool_name === "Bash" || input.tool_name === "PowerShell") {
    let dir = cwd;
    for (const command of simpleCommands(String(input.tool_input?.command ?? ""))) {
      const cd = /^(?:cd|chdir|sl|Set-Location|Push-Location|pushd)\s+(?:-(?:Path|LiteralPath)\s+)?(.+)$/i.exec(command);
      if (cd) {
        dir = resolveFrom(dir, cd[1].trim());
        continue;
      }
      const invocation = gitInvocation(command, dir);
      if (!invocation) continue;
      const where = fs.existsSync(invocation.where) ? inspect(invocation.where, git) : null;
      if (!where || where.commonDir !== mine.commonDir) continue;
      const fresh = newBranchBase(invocation);
      if (fresh) {
        const problem = staleBase(fresh.base, invocation.where, git);
        if (problem) return `Blocked: \`git worktree add\` for a new branch, but ${problem}.\n${HOW}`;
        continue;
      }
      if (!MUTATING.has(invocation.subcommand)) continue;
      if (invocation.subcommand === "stash" && /^(list|show)$/.test(invocation.rest[0] ?? "")) continue;
      if ((invocation.subcommand === "pull" || invocation.subcommand === "merge") && invocation.rest.includes("--ff-only") && where.branch === "main") continue;
      const reason = refusal(where);
      if (reason) return refuse(`\`git ${invocation.subcommand}\``, reason);
    }
  }
  return "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input = {};
  try {
    input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  } catch {
    process.exit(0); // never block on a payload this hook can't read
  }
  const message = decide(input, { project: process.env.CLAUDE_PROJECT_DIR || input.cwd });
  if (message) {
    console.error(message);
    process.exit(2);
  }
}
