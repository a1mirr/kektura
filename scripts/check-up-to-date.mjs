// Spec 0007 AC-11: the CI job "Up to date with main". A pull request whose base branch has moved on is flagged: the
// base branch must be an ancestor of the head. GitHub's "require branches to be up to date" setting is not available for
// a private repository on the free plan, so the author also checks this live before merging (spec 0021 AC-6).
// Usage (in CI, on a full clone): node scripts/check-up-to-date.mjs
// Reads the pull request from the event file ($GITHUB_EVENT_PATH).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// The decision. `behind` is how many commits of the base branch the head does not contain (0 = up to date).
export function checkUpToDate({ base, head, behind }) {
  if (behind === 0) return { ok: true, message: `Up to date with ${base} (head ${head.slice(0, 7)}).` };
  const commits = behind === 1 ? "1 commit" : `${behind} commits`;
  return {
    ok: false,
    message:
      `This pull request is ${commits} behind ${base}. Merge ${base} into the branch (git fetch origin, then git merge ${base}), ` +
      "run npm run check, and push: CI runs again, and the branch can be merged once it is up to date and green.",
  };
}

// How many commits the base has that the head lacks. `git(...args)` runs git and returns its stdout.
export function behindCount(git, base, head) {
  return Number(git("rev-list", "--count", `${head}..${base}`).trim());
}

function main() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const pr = event.pull_request;
  if (!pr) throw new Error("Not a pull request event.");
  const base = `origin/${pr.base.ref}`;
  const head = pr.head.sha.toLowerCase();
  const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  git("fetch", "--quiet", "origin", pr.base.ref); // the base as it is now, not as it was at checkout
  const result = checkUpToDate({ base, head, behind: behindCount(git, base, head) });
  console.log(result.message);
  if (!result.ok) {
    console.log(`::error title=Up to date with main::${result.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/").split("/").pop())) main();
