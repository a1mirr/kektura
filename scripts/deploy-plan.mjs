// Decides whether a commit of main is deployed (spec 0026 AC-12): compares it with the commit production runs.
//
//   node scripts/deploy-plan.mjs <target sha> [remote]      (remote defaults to `production`)
//
// Reads production's main through `git ls-remote` (so the deploy key and GIT_SSH_COMMAND must be set), looks at
// the paths that differ and writes `deploy=true|false` to $GITHUB_OUTPUT and the reason to the job summary.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { planDeploy } from "./lib/deploy.mjs";

/** A problem to tell the user about. Thrown, not process.exit(): see the Windows note in CLAUDE.md. */
export class Problem extends Error {}

const git = (...args) => spawnSync("git", args, { encoding: "utf8" });

/**
 * The commit production's main points to, or "" when it has none yet.
 * @param {string} remote
 * @param {(...args: string[]) => { status: number | null, stdout: string, stderr: string }} [run]
 */
export function productionMain(remote, run = git) {
  const result = run("ls-remote", remote, "refs/heads/main");
  if (result.status !== 0) {
    throw new Problem(`Could not reach production (git ls-remote ${remote} failed). Is the deploy key installed and DEPLOY_KNOWN_HOSTS right?\n${result.stderr.trim()}`);
  }
  const line = result.stdout.trim().split("\n")[0] ?? "";
  return line ? line.split(/\s+/)[0] : "";
}

/**
 * Everything the decision needs from the local repository.
 * @param {string} production
 * @param {string} target
 * @param {(...args: string[]) => { status: number | null, stdout: string, stderr: string }} [run]
 */
export function inspect(production, target, run = git) {
  if (!production || production === target) return { changed: [], targetIsBehind: false, comparable: true };
  if (run("cat-file", "-e", `${production}^{commit}`).status !== 0) return { changed: [], targetIsBehind: false, comparable: false };
  const diff = run("diff", "--name-only", production, target);
  if (diff.status !== 0) throw new Problem(`git diff ${production.slice(0, 7)} ${target.slice(0, 7)} failed:\n${diff.stderr.trim()}`);
  return {
    changed: diff.stdout.split("\n").filter(Boolean),
    targetIsBehind: run("merge-base", "--is-ancestor", target, production).status === 0,
    comparable: true,
  };
}

function main() {
  const [target, remote = "production"] = process.argv.slice(2);
  if (!target) throw new Problem("Usage: node scripts/deploy-plan.mjs <target sha> [remote]");
  const production = productionMain(remote);
  const { changed, targetIsBehind, comparable } = inspect(production, target);
  // A commit production runs that this history doesn't know (an emergency rollback) can't be compared: deploy.
  const plan = comparable ? planDeploy({ production, target, changed, targetIsBehind }) : { deploy: true, reason: "production runs a commit that is not in this history (a rollback?), so nothing can be compared" };
  const lines = [
    `Production runs ${production ? production.slice(0, 7) : "nothing yet"}; the target is ${target.slice(0, 7)}.`,
    `${plan.deploy ? "Deploy" : "Skip"}: ${plan.reason}.`,
  ];
  for (const line of lines) console.log(line);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `deploy=${plan.deploy}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Plan\n${lines.map((line) => `- ${line}`).join("\n")}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    if (!(error instanceof Problem)) throw error;
    console.error(error.message);
    process.exitCode = 1;
  }
}
