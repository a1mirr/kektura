import fs from "node:fs";
import { pathToFileURL } from "node:url";

const PROTECTED_REFS = new Set(["refs/heads/main"]);

// github.com as the host: after "//" or "@" (https, ssh://git@, git@github.com:), followed by ":" or "/".
// "notgithub.com" and "github.com.example.org" don't match.
const GITHUB_URL = /(^|[/@])github\.com[:/]/i;

export function pushedRefs(stdinText) {
  return stdinText
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 4)
    .map(([localRef, localSha, remoteRef, remoteSha]) => ({ localRef, localSha, remoteRef, remoteSha }));
}

export function checkPush(remoteUrl, stdinText) {
  if (!GITHUB_URL.test(remoteUrl)) return { ok: true };
  const blocked = pushedRefs(stdinText).filter((ref) => PROTECTED_REFS.has(ref.remoteRef));
  if (blocked.length === 0) return { ok: true };
  return {
    ok: false,
    message: [
      "Blocked: pushing to main on GitHub is not allowed here (spec 0021). main only changes through pull requests.",
      "Push a topic branch and open a pull request instead:",
      "  git fetch origin",
      "  git worktree add .claude/worktrees/<name> -b <topic> origin/main",
      "  git push -u origin <topic>",
      "(Deploying is a push to the 'production' remote and is not affected.)",
    ].join("\n"),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const remoteUrl = process.argv[3] ?? "";
  const result = checkPush(remoteUrl, fs.readFileSync(0, "utf8"));
  if (!result.ok) {
    console.error(result.message);
    process.exitCode = 1;
  }
}
