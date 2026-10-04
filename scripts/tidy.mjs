// Removes what a merge leaves behind (spec 0021 AC-8): linked worktrees under .claude/worktrees and local branches
// whose work is already in origin/main, and brings a local `main` that is only behind up to origin/main (so a
// stale `main` can never be the base of new work). A dry run unless --apply is given; --remote also deletes merged branches on
// origin (GitHub's "automatically delete head branches" does that for you when it is on).
//
//   node scripts/tidy.mjs [--apply] [--remote]
//
// "Merged" means a merge commit of origin/main brought the commit in (the repository merges pull requests with merge
// commits). A new branch that has no commit of its own yet is an ancestor of origin/main too, and must not be taken for
// finished work: another session may be about to start on it. Nothing is removed that could hold work: a worktree with a
// modified or untracked file, a branch that no merge commit contains, the primary checkout, the worktree this runs in
// (run it from another checkout to remove that one), a branch checked out anywhere else, `main`. Worktrees outside
// .claude/worktrees (other tools') are only ever listed as kept.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const NOT_MERGED = "no merge commit of origin/main contains it (unmerged work, or a new branch with no commit yet)";
const norm = (p) => path.resolve(p).replace(/\\/g, "/").toLowerCase();

/**
 * Decides what to remove. Pure: all state comes in.
 * @param {{ primary: string, current: string, worktrees: { path: string, branch: string | null, merged: boolean, clean: boolean }[],
 *   branches: { name: string, merged: boolean }[], remotes: { name: string, merged: boolean }[], localMain?: { behind: boolean } | null, protectedBranches?: string[] }} state
 */
export function planTidy({ primary, current, worktrees, branches, remotes, localMain = null, protectedBranches = ["main", "master"] }) {
  const keep = [];
  const removeWorktrees = [];
  const removed = new Set();
  const root = `${norm(primary)}/.claude/worktrees/`;

  for (const wt of worktrees) {
    const where = norm(wt.path);
    const label = wt.branch ?? "(detached)";
    let why = "";
    if (where === norm(primary)) why = "the primary checkout";
    else if (where === norm(current)) why = "the worktree this runs in";
    else if (!where.startsWith(root)) why = "outside .claude/worktrees (another tool's)";
    else if (!wt.clean) why = "has modified or untracked files";
    else if (!wt.merged) why = NOT_MERGED;
    if (why) keep.push({ what: `worktree ${label} (${wt.path})`, why });
    else {
      removeWorktrees.push({ path: wt.path, branch: wt.branch });
      removed.add(where);
    }
  }

  const heldBy = (name) => worktrees.find((wt) => wt.branch === name && !removed.has(norm(wt.path)));
  const deleteBranches = [];
  for (const branch of branches) {
    if (protectedBranches.includes(branch.name)) continue;
    const holder = heldBy(branch.name);
    if (!branch.merged) keep.push({ what: `branch ${branch.name}`, why: NOT_MERGED });
    else if (holder) keep.push({ what: `branch ${branch.name}`, why: `checked out in ${holder.path}` });
    else deleteBranches.push(branch.name);
  }

  const deleteRemote = [];
  for (const remote of remotes) {
    if (protectedBranches.includes(remote.name)) continue;
    if (remote.merged) deleteRemote.push(remote.name);
    else keep.push({ what: `origin/${remote.name}`, why: NOT_MERGED });
  }
  // A local main that is only behind is moved up, unless a worktree has it checked out (it is theirs to update).
  let advanceMain = false;
  if (localMain?.behind) {
    const holder = worktrees.find((wt) => wt.branch === "main");
    if (holder) keep.push({ what: "branch main (behind origin/main)", why: `checked out in ${holder.path}: update it there with git merge --ff-only origin/main` });
    else advanceMain = true;
  }
  return { removeWorktrees, deleteBranches, deleteRemote, advanceMain, keep };
}

/** Takes a node_modules junction or symlink out first: removing a worktree must never reach the real one. */
export function unlinkNodeModules(worktree) {
  const nm = path.join(worktree, "node_modules");
  let stat;
  try {
    stat = fs.lstatSync(nm);
  } catch {
    return false;
  }
  if (!stat.isSymbolicLink()) return false;
  fs.rmdirSync(nm); // removes the link itself, not what it points to
  return true;
}

const git = (cwd, args) => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { status: result.status ?? 1, stdout: (result.stdout ?? "").trim(), stderr: (result.stderr ?? "").trim() };
};

export function gatherState(cwd) {
  const top = git(cwd, ["rev-parse", "--path-format=absolute", "--show-toplevel", "--git-common-dir"]).stdout.split(/\r?\n/);
  const primary = path.dirname(top[1]); // <primary>/.git
  // Commits that came in through a merge commit: in origin/main, but not on its first-parent line.
  const lines = (args) => git(cwd, args).stdout.split(/\r?\n/).filter(Boolean);
  const firstParent = new Set(lines(["rev-list", "--first-parent", "origin/main"]));
  const viaMerge = new Set(lines(["rev-list", "origin/main"]).filter((sha) => !firstParent.has(sha)));
  const merged = (ref) => viaMerge.has(git(cwd, ["rev-parse", "--verify", "-q", `${ref}^{commit}`]).stdout);

  const worktrees = [];
  for (const block of git(cwd, ["worktree", "list", "--porcelain"]).stdout.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/);
    const wt = lines.find((l) => l.startsWith("worktree "))?.slice(9);
    const head = lines.find((l) => l.startsWith("HEAD "))?.slice(5);
    if (!wt || !head) continue;
    const branch = lines.find((l) => l.startsWith("branch "))?.slice(7).replace("refs/heads/", "") ?? null;
    const dirty = git(wt, ["status", "--porcelain"]);
    worktrees.push({ path: wt, branch, merged: merged(head), clean: dirty.status === 0 && dirty.stdout === "" });
  }
  const names = (ns) => git(cwd, ["for-each-ref", "--format=%(refname:short)", ns]).stdout.split(/\r?\n/).filter(Boolean);
  const branches = names("refs/heads").map((name) => ({ name, merged: merged(name) }));
  const remotes = names("refs/remotes/origin")
    .filter((n) => n !== "origin" && n !== "origin/HEAD")
    .map((n) => n.replace(/^origin\//, ""))
    .map((name) => ({ name, merged: merged(`origin/${name}`) }));
  const mainSha = git(cwd, ["rev-parse", "--verify", "-q", "refs/heads/main"]).stdout;
  const behind = Boolean(mainSha) && mainSha !== git(cwd, ["rev-parse", "origin/main"]).stdout && git(cwd, ["merge-base", "--is-ancestor", mainSha, "origin/main"]).status === 0;
  return { primary, current: top[0], worktrees, branches, remotes, localMain: mainSha ? { behind } : null };
}

function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const remote = args.includes("--remote");
  const unknown = args.filter((a) => a !== "--apply" && a !== "--remote");
  if (unknown.length) throw new Error(`Unknown argument ${JSON.stringify(unknown[0])}. Usage: node scripts/tidy.mjs [--apply] [--remote]`);

  const cwd = process.cwd();
  const fetched = git(cwd, ["fetch", "origin", "--prune"]);
  if (fetched.status !== 0) throw new Error(`git fetch origin --prune failed: ${fetched.stderr}`);

  const plan = planTidy(gatherState(cwd));
  const verb = apply ? "Removing" : "Would remove";
  for (const wt of plan.removeWorktrees) console.log(`${verb} worktree ${wt.path}${wt.branch ? ` (${wt.branch})` : ""}`);
  if (plan.advanceMain) console.log(`${apply ? "Moving" : "Would move"} local main up to origin/main`);
  for (const name of plan.deleteBranches) console.log(`${apply ? "Deleting" : "Would delete"} local branch ${name}`);
  for (const name of plan.deleteRemote) console.log(`${remote && apply ? "Deleting" : "Would delete"} origin/${name}${remote ? "" : " (needs --remote)"}`);
  for (const k of plan.keep) console.log(`Keeping ${k.what}: ${k.why}`);
  if (!apply) {
    console.log("Dry run: nothing was changed. Add --apply to do it.");
    return;
  }

  let failed = 0;
  const run = (what, result) => {
    if (result.status !== 0) {
      failed++;
      console.log(`Failed ${what}: ${result.stderr}`);
    }
  };
  const stuck = new Set(); // branches whose worktree would not go (locked, say): they stay, or the worktree would be left on a deleted branch
  for (const wt of plan.removeWorktrees) {
    unlinkNodeModules(wt.path);
    const result = git(cwd, ["worktree", "remove", wt.path]);
    run(`removing ${wt.path}`, result);
    if (result.status !== 0 && wt.branch) stuck.add(wt.branch);
  }
  git(cwd, ["worktree", "prune"]);
  if (plan.advanceMain) {
    // Only ever forward: planTidy saw main contained in origin/main, and update-ref is given the sha that was checked.
    const old = git(cwd, ["rev-parse", "--verify", "refs/heads/main"]).stdout;
    if (git(cwd, ["merge-base", "--is-ancestor", old, "origin/main"]).status === 0) run("moving main", git(cwd, ["update-ref", "refs/heads/main", "origin/main", old]));
  }
  // `git branch -d` would test "merged into HEAD", which depends on where this runs; what matters is origin/main, so
  // the check is repeated here and the ref is deleted only at the sha that was checked (never `-D`).
  for (const name of plan.deleteBranches) {
    if (stuck.has(name)) {
      console.log(`Keeping branch ${name}: its worktree could not be removed`);
      continue;
    }
    const sha = git(cwd, ["rev-parse", "--verify", `refs/heads/${name}`]).stdout;
    if (!sha || git(cwd, ["merge-base", "--is-ancestor", sha, "origin/main"]).status !== 0) {
      run(`deleting ${name}`, { status: 1, stderr: "it is no longer contained in origin/main" });
      continue;
    }
    run(`deleting ${name}`, git(cwd, ["update-ref", "-d", `refs/heads/${name}`, sha]));
    git(cwd, ["config", "--remove-section", `branch.${name}`]); // its tracking settings; fine when there are none
  }
  if (remote) for (const name of plan.deleteRemote) run(`deleting origin/${name}`, git(cwd, ["push", "origin", "--delete", name]));
  if (failed) throw new Error(`${failed} step${failed === 1 ? "" : "s"} failed.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error.message); // no process.exit(): see the Windows note in CLAUDE.md
    process.exitCode = 1;
  }
}
