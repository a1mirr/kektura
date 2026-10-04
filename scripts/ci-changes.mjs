// Spec 0007 AC-10: does a pull request change anything but Markdown? The CI job "Typecheck, lint, unit tests" runs this
// first and publishes the answer as its `code_changed` output; "End-to-end tests" runs only when it is `true`, so a
// documentation-only pull request does not pay for the database and the browser. Only a pull request can skip: on a push
// (to `main`) everything runs, because the deploy workflow relies on both jobs having run (spec 0026 AC-1).
// Usage (in CI, after a checkout with `fetch-depth: 2`): node scripts/ci-changes.mjs
// Reads $GITHUB_EVENT_NAME and writes `code_changed=true|false` to $GITHUB_OUTPUT.
// When in doubt (an unexpected checkout, an empty list) the answer is `true`: running too much is the safe mistake.
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { isMarkdown } from "./check-review-recorded.mjs";

// The decision. `files` is the list of paths the pull request changes, or null when it could not be read.
// A renamed file is listed under both paths (see changedFiles), so a Markdown file renamed to code counts as code.
export function codeChanged({ eventName, files }) {
  if (eventName !== "pull_request") return true;
  if (!files || files.length === 0) return true;
  return files.some((file) => !isMarkdown(file));
}

// The files a pull request changes, from the checkout CI makes for it: the merge commit of the pull request into its
// base (`refs/pull/N/merge`), whose first parent is the base. `git(...args)` runs git and returns its stdout, and throws
// when git exits with an error. Null when HEAD is not a merge commit or git cannot say, so the caller runs everything.
export function changedFiles(git) {
  try {
    const parents = git("rev-list", "--parents", "-n", "1", "HEAD").trim().split(/\s+/).length - 1;
    if (parents !== 2) return null;
    // --no-renames: a Markdown file renamed to code lists both paths, so the code path shows.
    return git("-c", "core.quotepath=false", "diff", "--name-only", "--no-renames", "HEAD^1", "HEAD").split("\n").filter(Boolean);
  } catch {
    return null;
  }
}

function main() {
  const eventName = process.env.GITHUB_EVENT_NAME ?? "";
  const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const files = eventName === "pull_request" ? changedFiles(git) : null;
  const result = codeChanged({ eventName, files });
  const why =
    eventName !== "pull_request"
      ? `not a pull request (${eventName || "no event"}): everything runs`
      : files === null || files.length === 0
        ? "the changed files could not be listed: everything runs"
        : result
          ? `${files.filter((file) => !isMarkdown(file)).length} of ${files.length} changed files are not Markdown: everything runs`
          : `${files.length} changed files, all Markdown: the end-to-end job is skipped`;
  console.log(`code_changed=${result} (${why})`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `code_changed=${result}\n`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/").split("/").pop())) main();
