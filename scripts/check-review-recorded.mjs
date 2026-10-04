// Spec 0022 AC-5: the CI job "Review recorded". A pull request description must name, on a `Reviewed commit:` line,
// a commit that exists and is the head of the pull request or an ancestor of it; when it is an ancestor, nothing but
// Markdown may have changed after it. It proves that a review was recorded at a commit, not that it was good.
// Usage (in CI, on a full clone): node scripts/check-review-recorded.mjs
// Reads the pull request from the event file ($GITHUB_EVENT_PATH); the description is fetched fresh with `gh` ($GH_TOKEN)
// so that re-running the job after editing the description sees the edit, not the description of the original event.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// The sha on the last `Reviewed commit:` line of a description (7 to 40 hex digits, optionally in backticks), or null.
// HTML comments are dropped first: the pull request template explains the line inside one, and an unfilled
// placeholder such as `<short sha>` is not a sha.
export function reviewedSha(description) {
  const text = String(description ?? "").replace(/<!--[\s\S]*?-->/g, "");
  const found = [...text.matchAll(/^[ \t]*Reviewed commit:[ \t]*`?([0-9a-f]{7,40})`?[ \t]*\r?$/gim)];
  return found.length ? found.at(-1)[1].toLowerCase() : null;
}

// Whether a file counts as documentation: nothing but wording may change after a reviewed commit.
export const isMarkdown = (file) => file.endsWith(".md");

// The decision. `reviewed` says what git knows about the named commit, and is null when it does not exist or is
// neither the head nor an ancestor of it: { sha: its full sha, changedAfter: the files that differ between it and the
// head }. The result is { ok, message }.
export function checkReviewRecorded({ description, head, reviewed }) {
  const named = reviewedSha(description);
  if (!named) {
    return { ok: false, message: "The pull request description has no `Reviewed commit: <sha>` line (7 to 40 hex digits) naming the commit the fresh-context review covered." };
  }
  if (!reviewed) {
    return { ok: false, message: `\`Reviewed commit: ${named}\` is not the head of this pull request or one of its ancestors (unknown sha, or a commit that is not in this branch's history).` };
  }
  if (reviewed.sha === head) {
    return { ok: true, message: `Review recorded at the head, ${head.slice(0, 7)}.` };
  }
  const code = reviewed.changedAfter.filter((file) => !isMarkdown(file));
  if (code.length) {
    const shown = code.slice(0, 5).join(", ") + (code.length > 5 ? `, and ${code.length - 5} more` : "");
    return {
      ok: false,
      message: `Files other than Markdown changed after the reviewed commit ${reviewed.sha.slice(0, 7)}: ${shown}. They need a new review and a new \`Reviewed commit:\` sha (wording fixes included: moving the sha is the point).`,
    };
  }
  return { ok: true, message: `Review recorded at ${reviewed.sha.slice(0, 7)}; only Markdown changed after it (head ${head.slice(0, 7)}).` };
}

// What git knows about the named commit, for checkReviewRecorded. `git(...args)` runs git and returns its stdout, and
// throws when git exits with an error.
export function inspectCommit(git, sha, head) {
  let full;
  try {
    full = git("rev-parse", "--verify", "--quiet", `${sha}^{commit}`).trim();
  } catch {
    return null;
  }
  if (full === head) return { sha: full, changedAfter: [] };
  try {
    git("merge-base", "--is-ancestor", full, head);
  } catch {
    return null;
  }
  // --no-renames: a Markdown file renamed to code lists both paths, so the code path shows.
  const changedAfter = git("-c", "core.quotepath=false", "diff", "--name-only", "--no-renames", full, head).split("\n").filter(Boolean);
  return { sha: full, changedAfter };
}

function main() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const pr = event.pull_request;
  if (!pr) throw new Error("Not a pull request event.");
  if (pr.user?.login === "dependabot[bot]") {
    console.log("A Dependabot pull request: CI judges it, no review is recorded (spec 0022).");
    return;
  }
  const head = pr.head.sha.toLowerCase();
  const description = process.env.GH_TOKEN
    ? execFileSync("gh", ["api", `repos/${process.env.GITHUB_REPOSITORY}/pulls/${pr.number}`, "--jq", ".body // \"\""], { encoding: "utf8" })
    : pr.body;
  const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const named = reviewedSha(description);
  const result = checkReviewRecorded({ description, head, reviewed: named ? inspectCommit(git, named, head) : null });
  console.log(result.message);
  if (!result.ok) {
    console.log(`::error title=Review recorded::${result.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/").split("/").pop())) main();
