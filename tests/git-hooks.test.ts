import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { checkPush, pushedRefs } from "../.githooks/guard.mjs";

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const GUARD = new URL("../.githooks/guard.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const SHA = "a".repeat(40);
const ZERO = "0".repeat(40);
const line = (localRef: string, remoteRef: string, localSha = SHA, remoteSha = ZERO) => `${localRef} ${localSha} ${remoteRef} ${remoteSha}\n`;

const GITHUB_URLS = ["https://github.com/a1mirr/kektura", "https://github.com/a1mirr/kektura.git", "git@github.com:a1mirr/kektura.git", "ssh://git@github.com/a1mirr/kektura.git", "https://user@github.com/a1mirr/kektura"];

describe("spec 0021: pull requests only", () => {
  describe("AC-1: a push to main on GitHub is refused", () => {
    it.each(GITHUB_URLS)("%s", (url) => {
      const result = checkPush(url, line("refs/heads/main", "refs/heads/main"));
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/pull request/i);
      expect(result.message).toContain("git push -u origin");
    });

    it.each([
      ["HEAD:main", line("refs/heads/topic", "refs/heads/main")],
      ["a forced push (+main): the same ref line", line("refs/heads/main", "refs/heads/main", SHA, "b".repeat(40))],
      ["deleting main (:main)", line("(delete)", "refs/heads/main", ZERO, SHA)],
      ["main among several refs", line("refs/heads/topic", "refs/heads/topic") + line("refs/heads/main", "refs/heads/main")],
    ])("%s", (_name, stdin) => {
      expect(checkPush("https://github.com/a1mirr/kektura", stdin).ok).toBe(false);
    });
  });

  describe("AC-2: other pushes to GitHub are not affected", () => {
    it.each([
      ["a topic branch", line("refs/heads/topic", "refs/heads/topic")],
      ["a branch whose name only contains main", line("refs/heads/main-menu", "refs/heads/main-menu")],
      ["a branch under a main/ prefix", line("refs/heads/main/fix", "refs/heads/main/fix")],
      ["a tag", line("refs/tags/v1", "refs/tags/v1")],
      ["deleting a topic branch (the cleanup after a merge)", line("(delete)", "refs/heads/topic", ZERO, SHA)],
      ["a local main pushed to a topic branch", line("refs/heads/main", "refs/heads/topic")],
      ["nothing at all", ""],
    ])("%s", (_name, stdin) => {
      expect(checkPush("https://github.com/a1mirr/kektura", stdin)).toEqual({ ok: true });
    });
  });

  describe("AC-3: other remotes are not affected", () => {
    it.each([
      ["the deploy remote", "a1mirr@188.166.117.212:~/kektura.git"],
      ["a local bare repository", "C:/somewhere/kektura.git"],
      ["a look-alike host", "https://notgithub.com/a1mirr/kektura"],
      ["a host that merely starts with github.com", "https://github.com.example.org/a1mirr/kektura"],
    ])("%s", (_name, url) => {
      expect(checkPush(url, line("refs/heads/main", "refs/heads/main"))).toEqual({ ok: true });
    });
  });

  it("reads the ref lines git sends and ignores blank or short ones", () => {
    expect(pushedRefs(`\n${line("refs/heads/a", "refs/heads/b")}broken line\n`)).toEqual([
      { localRef: "refs/heads/a", localSha: SHA, remoteRef: "refs/heads/b", remoteSha: ZERO },
    ]);
  });

  describe("AC-1/AC-3: the guard as git runs it (a process, stdin from git, the URL as the 2nd argument)", () => {
    const run = (url: string, stdin: string) => spawnSync(process.execPath, [GUARD, "origin", url], { input: stdin, encoding: "utf8" });

    it("exits 1 with the explanation on stderr for a push to main on GitHub", () => {
      const result = run("git@github.com:a1mirr/kektura.git", line("refs/heads/main", "refs/heads/main"));
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/pull request/i);
    });

    it("exits 0 and says nothing for a topic branch, and for main on the deploy remote", () => {
      for (const [url, stdin] of [
        ["https://github.com/a1mirr/kektura", line("refs/heads/topic", "refs/heads/topic")],
        ["a1mirr@188.166.117.212:~/kektura.git", line("refs/heads/main", "refs/heads/main")],
      ]) {
        const result = run(url, stdin);
        expect(result.status, `${url}: ${result.stderr}`).toBe(0);
        expect(result.stderr).toBe("");
      }
    });
  });

  describe("AC-4: the hook is versioned and installed with one command", () => {
    it("the pre-push script runs the guard with git's arguments and stdin", () => {
      const hook = read(".githooks/pre-push");
      expect(hook.startsWith("#!/bin/sh")).toBe(true);
      expect(hook).toContain('exec node "$(dirname "$0")/guard.mjs" "$@"');
      expect(hook).not.toContain("\r"); // CRLF would break the shebang on Linux and macOS
    });

    it("`npm run hooks:install` points git at .githooks", () => {
      const scripts = JSON.parse(read("package.json")).scripts;
      expect(scripts["hooks:install"]).toBe("git config core.hooksPath .githooks");
    });

    it("no install-time script switches hooks on by itself (npm ci runs on the production server too)", () => {
      const scripts = JSON.parse(read("package.json")).scripts;
      for (const name of ["prepare", "preinstall", "install", "postinstall"]) expect(scripts[name], name).toBeUndefined();
    });
  });

  it("AC-5: CLAUDE.md states the rule and the install step", () => {
    const claude = read("CLAUDE.md");
    expect(claude).toMatch(/pull request/i);
    expect(claude).toContain("npm run hooks:install");
  });

  it("AC-6: CLAUDE.md says how pull requests are opened and merged with gh, and when merging is allowed", () => {
    const claude = read("CLAUDE.md");
    expect(claude).toContain('gh pr create --base main --head <topic> --title "<title>" --body-file <file>');
    expect(claude).toContain("`gh pr checks <n>` once, never with `--watch` or a sleep loop");
    expect(claude).toContain("gh pr merge <n> --merge --match-head-commit <full-sha>");
    expect(claude).toMatch(/on the owner's standing permission \(given in chat on 2026-10-03, revocable\) for pull requests you wrote, once CI is green and the fresh-context review is done/);
    expect(claude).toContain("never `--admin`");
    expect(claude).toContain("merge `origin/main` into the branch");
    expect(claude).toContain("Delete the pull request's branch after the merge, remote and local");
    expect(claude).toContain("git merge-base --is-ancestor origin/<topic> origin/main");
    expect(claude).toContain("Delete only branches of pull requests you merged");
    expect(claude).toContain("only for a rollback or when the workflow is broken");
    expect(claude).toContain(String.raw`C:\Program Files\GitHub CLI`);
    expect(claude).not.toContain(String.raw`%LOCALAPPDATA%\Programs\gh`);
    expect(claude).not.toContain("There is no `gh` here");
    // No control characters other than line breaks and tabs.
    const control = [...claude].filter((ch) => ch.charCodeAt(0) < 32 && !["\n", "\r", "\t"].includes(ch));
    expect(control).toEqual([]);
    expect(claude).not.toMatch(/\r(?!\n)/); // a lone carriage return: this is what `\r` in a path turned into
    expect(claude).toContain(String.raw`%LOCALAPPDATA%\Docker\run`);
    expect(claude).toContain("Spec 0021 owns these pull request rules");
    expect(claude).toContain("`git fetch origin`, check it is in `main`");
    expect(claude).toContain("never `-D`");
  });
});
