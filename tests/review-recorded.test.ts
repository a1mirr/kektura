import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { checkReviewRecorded, inspectCommit, reviewedSha } from "../scripts/check-review-recorded.mjs";

// The git tests spawn several processes each, and the unit tests run in dozens of workers at once: the default 5 s and 10 s
// (a test and a hook) were missed under load, while the same file passes alone in about a second.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

const read = (file: string) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const HEAD = "a".repeat(40);
const OLD = "b".repeat(40);
const body = (sha: string) => `## What and why\n\nSomething.\n\n## Review findings\n\nReviewed commit: \`${sha}\`\n\nNo findings.\n`;

describe("spec 0022: Review recorded", () => {
  describe("AC-5: reading the description", () => {
    it("finds the sha on a `Reviewed commit:` line, with or without backticks, short or full, with CRLF line ends", () => {
      expect(reviewedSha("Reviewed commit: `abc1234`")).toBe("abc1234");
      expect(reviewedSha("Reviewed commit: abc1234")).toBe("abc1234");
      expect(reviewedSha(`x\r\nReviewed commit: \`${HEAD}\`\r\ny`)).toBe(HEAD);
      expect(reviewedSha("Reviewed commit: ABC1234")).toBe("abc1234");
    });

    it("finds nothing in an empty or missing description, an unfilled placeholder, a too short or non-hex sha", () => {
      expect(reviewedSha(null)).toBeNull();
      expect(reviewedSha("")).toBeNull();
      expect(reviewedSha("Reviewed commit: `<short sha>`")).toBeNull();
      expect(reviewedSha("Reviewed commit: `abc12`")).toBeNull();
      expect(reviewedSha("Reviewed commit: `not-a-sha-at-all`")).toBeNull();
      expect(reviewedSha("The reviewed commit is abc1234")).toBeNull();
    });

    it("ignores the template's explanation inside an HTML comment and takes the last line when there are several", () => {
      expect(reviewedSha("<!--\nReviewed commit: `abc1234`\n-->\nReviewed commit: `<short sha>`")).toBeNull();
      expect(reviewedSha("Reviewed commit: `1111111`\nReviewed commit: `2222222`")).toBe("2222222");
    });
  });

  describe("AC-5: the decision", () => {
    it("fails when the description has no Reviewed commit line", () => {
      const result = checkReviewRecorded({ description: "No review here", head: HEAD, reviewed: null });
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/no `Reviewed commit: <sha>` line/);
    });

    it("fails when the sha is unknown or not in the pull request's history", () => {
      const result = checkReviewRecorded({ description: body("deadbee"), head: HEAD, reviewed: null });
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/not the head of this pull request or one of its ancestors/);
    });

    it("passes when the reviewed commit is the head", () => {
      expect(checkReviewRecorded({ description: body(HEAD), head: HEAD, reviewed: { sha: HEAD, changedAfter: [] } }).ok).toBe(true);
    });

    it("passes when the reviewed commit is an ancestor and only Markdown changed after it", () => {
      const reviewed = { sha: OLD, changedAfter: ["CLAUDE.md", "specs/project/0022-fresh-context-review.md", ".github/ISSUE_TEMPLATE/task.md"] };
      expect(checkReviewRecorded({ description: body(OLD), head: HEAD, reviewed }).ok).toBe(true);
    });

    it("passes when the reviewed commit is an ancestor and nothing changed after it", () => {
      expect(checkReviewRecorded({ description: body(OLD), head: HEAD, reviewed: { sha: OLD, changedAfter: [] } }).ok).toBe(true);
    });

    it("fails when anything but Markdown changed after the ancestor, naming the files (a wording fix in code or messages included)", () => {
      const reviewed = { sha: OLD, changedAfter: ["specs/project/0022-fresh-context-review.md", "messages/en.json", "src/app/page.tsx"] };
      const result = checkReviewRecorded({ description: body(OLD), head: HEAD, reviewed });
      expect(result.ok).toBe(false);
      expect(result.message).toContain("messages/en.json");
      expect(result.message).toContain("src/app/page.tsx");
      expect(result.message).not.toContain("0022-fresh-context-review.md");
      expect(result.message).toMatch(/new review and a new `Reviewed commit:` sha/);
    });

    it("counts only the `.md` extension as Markdown", () => {
      for (const file of ["notes.md.ts", "README.mdx", "md", "docs/readme.txt"]) {
        expect(checkReviewRecorded({ description: body(OLD), head: HEAD, reviewed: { sha: OLD, changedAfter: [file] } }).ok, file).toBe(false);
      }
    });
  });

  describe("AC-5: what git says about the named commit", () => {
    let dir: string;
    const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const commit = (files: Record<string, string>, message: string) => {
      for (const [name, content] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
        fs.writeFileSync(path.join(dir, name), content);
      }
      git("add", "-A");
      git("-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", "commit", "-m", message);
      return git("rev-parse", "HEAD").trim();
    };
    let base: string;
    let afterDocs: string;
    let afterCode: string;
    let side: string;

    beforeAll(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), "review-recorded-"));
      git("init", "-q", "-b", "main");
      base = commit({ "src/a.ts": "1", "README.md": "1" }, "base");
      afterDocs = commit({ "README.md": "2", "specs/x.md": "1" }, "docs");
      afterCode = commit({ "src/a.ts": "2", "docs/y.md": "1" }, "code");
      git("switch", "-q", "-c", "side", base);
      side = commit({ "src/b.ts": "1" }, "side branch");
      git("switch", "-q", "main");
    });
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    it("resolves a short sha, and says nothing changed when it is the head", () => {
      expect(inspectCommit(git, afterCode.slice(0, 7), afterCode)).toEqual({ sha: afterCode, changedAfter: [] });
    });

    it("lists the files that changed between an ancestor and the head", () => {
      const reviewed = inspectCommit(git, afterDocs.slice(0, 10), afterCode);
      expect(reviewed?.sha).toBe(afterDocs);
      expect([...(reviewed?.changedAfter ?? [])].sort()).toEqual(["docs/y.md", "src/a.ts"]);
      expect(inspectCommit(git, base, afterDocs)?.changedAfter.sort()).toEqual(["README.md", "specs/x.md"]);
    });

    it("answers null for an unknown sha and for a commit that is not an ancestor of the head", () => {
      expect(inspectCommit(git, "deadbeefdeadbeef", afterCode)).toBeNull();
      expect(inspectCommit(git, side, afterCode)).toBeNull();
    });

    it("lists both paths when a Markdown file became code", () => {
      git("mv", "docs/y.md", "docs/y.ts");
      const renamed = commit({}, "rename");
      expect(inspectCommit(git, afterCode, renamed)?.changedAfter.sort()).toEqual(["docs/y.md", "docs/y.ts"]);
      expect(checkReviewRecorded({ description: body(afterCode), head: renamed, reviewed: inspectCommit(git, afterCode, renamed) }).ok).toBe(false);
    });
  });

  describe("AC-5: updating a reviewed branch from its base does not need a new review", () => {
    let dir: string;
    const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const ident = ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false"];
    const commit = (file: string, content: string, message: string) => {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), content);
      git("add", "-A");
      git(...ident, "commit", "-m", message);
      return git("rev-parse", "HEAD").trim();
    };
    let reviewed: string;
    let afterMerge: string;
    let afterDocs: string;
    let afterCode: string;
    let afterResolution: string;

    beforeAll(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), "review-recorded-base-"));
      git("init", "-q", "-b", "main");
      commit("src/shared.ts", "base", "base");
      git("switch", "-q", "-c", "topic");
      reviewed = commit("src/topic.ts", "1", "the reviewed work");
      git("switch", "-q", "main");
      commit("messages/en.json", "main", "main changes code and messages");
      commit("src/shared.ts", "main version", "main changes a shared file");
      git("switch", "-q", "topic");
      git(...ident, "merge", "--no-edit", "main");
      afterMerge = git("rev-parse", "HEAD").trim();
      afterDocs = commit("specs/x.md", "1", "wording");
      afterCode = commit("src/topic.ts", "2", "a code change after the review");
      git("switch", "-q", "main");
      commit("src/conflict.ts", "main side", "main");
      git("switch", "-q", "topic");
      commit("src/conflict.ts", "topic side", "topic");
      try {
        git(...ident, "merge", "--no-edit", "main");
      } catch {
        // expected: the conflict
      }
      fs.writeFileSync(path.join(dir, "src/conflict.ts"), "resolved by the author");
      git("add", "-A");
      git(...ident, "commit", "--no-edit");
      afterResolution = git("rev-parse", "HEAD").trim();
    });
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    it("without a base every file that differs counts: the files merged in from main look like code changed after the review", () => {
      expect(inspectCommit(git, reviewed, afterMerge)?.changedAfter.sort()).toEqual(["messages/en.json", "src/shared.ts"]);
    });

    it("with the base, the files that arrived by merging it do not count", () => {
      expect(inspectCommit(git, reviewed, afterMerge, "main")).toEqual({ sha: reviewed, changedAfter: [] });
      const result = checkReviewRecorded({ description: body(reviewed), head: afterMerge, reviewed: inspectCommit(git, reviewed, afterMerge, "main") });
      expect(result.ok).toBe(true);
    });

    it("with the base, Markdown written after the merge still passes, and code written after it still fails", () => {
      expect(inspectCommit(git, reviewed, afterDocs, "main")?.changedAfter).toEqual(["specs/x.md"]);
      expect(checkReviewRecorded({ description: body(reviewed), head: afterDocs, reviewed: inspectCommit(git, reviewed, afterDocs, "main") }).ok).toBe(true);
      expect(inspectCommit(git, reviewed, afterCode, "main")?.changedAfter.sort()).toEqual(["specs/x.md", "src/topic.ts"]);
      expect(checkReviewRecorded({ description: body(reviewed), head: afterCode, reviewed: inspectCommit(git, reviewed, afterCode, "main") }).ok).toBe(false);
    });

    it("with the base, a conflict resolved by hand in a merge commit counts as the author's change", () => {
      const changed = inspectCommit(git, reviewed, afterResolution, "main")?.changedAfter ?? [];
      expect(changed).toContain("src/conflict.ts");
      expect(checkReviewRecorded({ description: body(reviewed), head: afterResolution, reviewed: inspectCommit(git, reviewed, afterResolution, "main") }).ok).toBe(false);
    });

    it("with the base, a file that both sides edited in different places and that merged cleanly does not count", () => {
      const list = (edits: Record<number, string> = {}) =>
        Array.from({ length: 40 }, (_, i) => edits[i + 1] ?? String(i + 1)).join("\n") + "\n";
      git("switch", "-q", "main");
      commit("shared/list.txt", list(), "main adds a file");
      git("switch", "-q", "topic");
      git(...ident, "merge", "--no-edit", "main");
      const reviewedHere = commit("shared/list.txt", list({ 2: "topic edit" }), "topic edits near the top");
      git("switch", "-q", "main");
      commit("shared/list.txt", list({ 38: "main edit" }), "main edits near the bottom");
      git("switch", "-q", "topic");
      git(...ident, "merge", "--no-edit", "main");
      const merged = git("rev-parse", "HEAD").trim();
      // the file differs from the reviewed commit and `--cc` would list it, but nobody changed it by hand
      expect(inspectCommit(git, reviewedHere, merged)?.changedAfter).toEqual(["shared/list.txt"]);
      expect(inspectCommit(git, reviewedHere, merged, "main")).toEqual({ sha: reviewedHere, changedAfter: [] });
      const result = checkReviewRecorded({ description: body(reviewedHere), head: merged, reviewed: inspectCommit(git, reviewedHere, merged, "main") });
      expect(result.ok).toBe(true);
    });

    it("main's own files never show up when the branch merges main again, with nothing else changed", () => {
      expect(inspectCommit(git, afterResolution, afterResolution, "main")).toEqual({ sha: afterResolution, changedAfter: [] });
    });
  });

  describe("AC-5: the CI job", () => {
    const ci = read(".github/workflows/ci.yml");
    const lines = ci.split("\n");
    const start = lines.findIndex((line) => line === "  review:");
    const end = lines.findIndex((line, i) => i > start && /^ {2}[a-z]/.test(line));
    const review = lines.slice(start, end === -1 ? undefined : end).join("\n");

    it("is named `Review recorded` and runs the script on a full clone", () => {
      expect(start).toBeGreaterThan(-1);
      expect(review).toContain("name: Review recorded");
      expect(review).toMatch(/fetch-depth: 0/);
      expect(review).toMatch(/- run: node scripts\/check-review-recorded\.mjs/);
      expect(fs.existsSync(new URL("../scripts/check-review-recorded.mjs", import.meta.url))).toBe(true);
    });

    it("runs on pull requests only, and not for Dependabot's", () => {
      expect(review).toMatch(/if: github\.event_name == 'pull_request' && github\.event\.pull_request\.user\.login != 'dependabot\[bot\]'/);
      expect(ci).toMatch(/^on:\s*\n\s+push:\s*\n\s+branches: \[main\]\s*\n\s+pull_request:/m);
    });

    it("may read the pull request's description and nothing else, with the workflow's own token", () => {
      expect(review).toMatch(/permissions:\s*\n\s+contents: read\s*\n\s+pull-requests: read/);
      expect(review).toContain("GH_TOKEN: ${{ github.token }}");
      expect(ci).not.toMatch(/\$\{\{\s*secrets\./);
    });

    it("is named in CLAUDE.md step 7 among the jobs that must be green, and in the pull request template", () => {
      const claude = read("CLAUDE.md");
      expect(claude).toMatch(/CI's jobs: "Typecheck, lint, unit tests", "End-to-end tests" and, for a pull request that is not Dependabot's, "Review recorded"/);
      expect(read(".github/pull_request_template.md")).toMatch(/Review recorded/);
    });
  });
});
