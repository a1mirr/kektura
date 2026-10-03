// Spec 0026: the properties of the deploy workflow that keep production safe, so a later edit can't remove them
// unnoticed. The workflow itself only runs on GitHub; the scripts it calls have their own tests.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const workflow = read(".github/workflows/deploy.yml");
const lines = workflow.split("\n");

// The text of one step of the job, from its `- name:` line to the next step.
function step(name: string) {
  const start = lines.findIndex((line) => line.includes(`- name: ${name}`));
  expect(start, `a step named "${name}"`).toBeGreaterThan(-1);
  const end = lines.findIndex((line, i) => i > start && /^ {6}- /.test(line));
  return lines.slice(start, end === -1 ? undefined : end).join("\n");
}

describe("spec 0026: the deploy workflow", () => {
  describe("AC-1: only a successful CI run on main starts it", () => {
    it("is started by the end of the CI workflow, filtered to main, and by hand", () => {
      expect(workflow).toMatch(/workflow_run:\s*\n\s+workflows: \[CI\]\s*\n\s+types: \[completed\]\s*\n\s+branches: \[main\]/);
      expect(workflow).toMatch(/^ {2}workflow_dispatch:/m);
      expect(read(".github/workflows/ci.yml")).toMatch(/^name: CI$/m);
    });

    it("waits for both CI jobs by name: the workflow_run conclusion covers every job of CI", () => {
      const ci = read(".github/workflows/ci.yml");
      expect(ci).toContain("name: Typecheck, lint, unit tests");
      expect(ci).toContain("name: End-to-end tests");
    });

    it("the job runs only for a successful push to main of this very repository (or by hand)", () => {
      const condition = workflow.slice(workflow.indexOf("    if: >-"), workflow.indexOf("    runs-on:"));
      for (const part of [
        "github.event_name == 'workflow_dispatch'",
        "github.event.workflow_run.conclusion == 'success'",
        "github.event.workflow_run.event == 'push'",
        "github.event.workflow_run.head_branch == 'main'",
        "github.event.workflow_run.head_repository.full_name == github.repository",
      ]) {
        expect(condition, part).toContain(part);
      }
    });

    it("never reacts to pull requests, and checks out the commit CI ran on, not a moving branch", () => {
      const triggers = workflow.slice(workflow.indexOf("\non:"), workflow.indexOf("\npermissions:"));
      expect(triggers).not.toMatch(/pull_request/);
      expect(triggers).not.toMatch(/^ {2}push:/m);
      expect(step("Notice when the secrets are missing")).toBeTruthy();
      expect(workflow).toContain("ref: ${{ github.event.workflow_run.head_sha || github.sha }}");
      expect(workflow).toContain("persist-credentials: false");
    });
  });

  it("AC-2: one deploy at a time, a waiting one is not cancelled by being queued behind a running one", () => {
    expect(workflow).toMatch(/^concurrency:\s*\n {2}group: deploy\s*\n {2}cancel-in-progress: false/m);
  });

  describe("AC-3: a manual run with a dry run that changes nothing", () => {
    it("has a dry_run input that is on by default, and a baseline input", () => {
      expect(workflow).toMatch(/dry_run:\s*\n(\s+.*\n)*?\s+type: boolean\s*\n\s+default: true/);
      expect(workflow).toMatch(/baseline:\s*\n(\s+.*\n)*?\s+type: string/);
      expect(workflow).toContain("DRY_RUN: ${{ github.event_name == 'workflow_dispatch' && inputs.dry_run }}");
    });

    it("passes --dry-run to the migrations, and neither pushes nor smoke-tests during a dry run", () => {
      expect(step("Apply the missing migrations")).toMatch(/if \[ "\$DRY_RUN" = "true" \]; then args\+=\(--dry-run\); fi/);
      for (const name of ["Push the code to production", "Check that the site answers"]) {
        expect(step(name), name).toContain("env.DRY_RUN != 'true'");
      }
    });

    it("only migrates and pushes when the plan says deploy (a baseline may also run the migration step, to be recorded)", () => {
      expect(step("Push the code to production")).toContain("steps.plan.outputs.deploy == 'true'");
      expect(step("Apply the missing migrations")).toContain("(steps.plan.outputs.deploy == 'true' || env.BASELINE != '')");
    });
  });

  describe("AC-4, AC-7: migrations first, then the code, then the check, in that order", () => {
    it("lists the steps in that order", () => {
      const order = ["Reach production and decide what to deploy", "Apply the missing migrations", "Push the code to production", "Check that the site answers"].map((name) =>
        workflow.indexOf(`- name: ${name}`),
      );
      expect(order.every((position) => position > -1)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });
  });

  describe("AC-7: the code goes to the production remote only, as a fast-forward", () => {
    it("pushes the commit CI passed to main of `production`, never forced", () => {
      const push = step("Push the code to production");
      expect(push).toContain('git push production "$TARGET_SHA:refs/heads/main"');
      expect(workflow).not.toMatch(/--force|--force-with-lease|git push [^\n]* -f\b|git push [^\n]*\+/);
      expect(workflow.match(/git push/g)).toHaveLength(1);
    });

    it("authenticates with the deploy key, a pinned host key and no prompt", () => {
      const setup = step("Set up the deploy key");
      expect(setup).toContain("StrictHostKeyChecking=yes");
      expect(setup).toContain("IdentitiesOnly=yes");
      expect(setup).toContain('git remote add production "$DEPLOY_REMOTE"');
      expect(workflow).toContain("DEPLOY_REMOTE: a1mirr@188.166.117.212:~/kektura.git");
    });
  });

  describe("AC-9: a failure is reported once, with the way back", () => {
    it("has a failure step that runs the Telegram script and writes the rollback advice to the summary", () => {
      const failure = step("Tell the developer, and say how to roll back");
      expect(failure).toContain("if: failure()");
      expect(failure).toContain("node scripts/notify-telegram.mjs");
      expect(failure).toContain("GITHUB_STEP_SUMMARY");
      expect(failure).toMatch(/Nothing was rolled back by itself/);
      expect(failure).toMatch(/revert the pull request on main and merge the revert/);
      for (const id of ["plan", "migrate", "push", "smoke"]) expect(failure).toContain(`steps.${id}.outcome`);
    });

    it("names the steps the failure message refers to", () => {
      for (const id of ["plan", "migrate", "push", "smoke"]) expect(workflow).toContain(`id: ${id}`);
    });
  });

  describe("AC-10: secrets are only referenced in a step's env, never printed; contents are read-only", () => {
    it("has read-only permissions for the repository contents and nothing else", () => {
      expect(workflow).toMatch(/^permissions:\n {2}contents: read\n\n/m);
    });

    it("references every secret only in an `env` mapping line", () => {
      const withSecrets = lines.filter((line) => line.includes("secrets."));
      expect(withSecrets.length).toBeGreaterThan(5);
      for (const line of withSecrets) expect(line, line).toMatch(/^ +[A-Z_]+: \$\{\{ secrets\.[A-Z_]+( != '')?( && secrets\.[A-Z_]+ != '')* \}\}$/);
    });

    it("uses each secret in the one step that needs it", () => {
      expect(step("Set up the deploy key")).toMatch(/DEPLOY_SSH_KEY: \$\{\{ secrets\.DEPLOY_SSH_KEY \}\}/);
      expect(step("Apply the missing migrations")).toMatch(/SUPABASE_DB_URL: \$\{\{ secrets\.SUPABASE_DB_URL \}\}/);
      expect(step("Tell the developer, and say how to roll back")).toMatch(/TELEGRAM_BOT_TOKEN: \$\{\{ secrets\.TELEGRAM_BOT_TOKEN \}\}/);
      for (const name of ["Reach production and decide what to deploy", "Push the code to production", "Check that the site answers"]) {
        expect(step(name), name).not.toContain("secrets.");
      }
    });

    it("never echoes a secret: no tracing, and the variables only go to files", () => {
      const code = lines.filter((line) => !line.trim().startsWith("#")).join("\n"); // the header comment says "no set -x"
      expect(code).not.toMatch(/set -x|set -o xtrace|ACTIONS_STEP_DEBUG|ACTIONS_RUNNER_DEBUG/);
      for (const line of lines.filter((l) => /\$\{?(DEPLOY_SSH_KEY|DEPLOY_KNOWN_HOSTS|SUPABASE_DB_URL|TELEGRAM_BOT_TOKEN)\b/.test(l))) {
        expect(line, line).toMatch(/> ~\/\.ssh\/(deploy_key|known_hosts)$/);
      }
    });

    it("ends with a notice instead of failing while the secrets are missing", () => {
      expect(workflow).toContain("CONFIGURED: ${{ secrets.DEPLOY_SSH_KEY != '' && secrets.DEPLOY_KNOWN_HOSTS != '' && secrets.SUPABASE_DB_URL != '' }}");
      expect(step("Notice when the secrets are missing")).toContain("if: env.CONFIGURED != 'true'");
      for (const name of ["Set up the deploy key", "Reach production and decide what to deploy", "Apply the missing migrations", "Push the code to production", "Check that the site answers"]) {
        expect(step(name), name).toContain("env.CONFIGURED == 'true'");
      }
    });
  });

  it("AC-11: CLAUDE.md and deploy/README.md describe the workflow and keep the manual way as the fallback", () => {
    const claude = read("CLAUDE.md");
    expect(claude).toContain("The merge itself deploys (spec 0026, `.github/workflows/deploy.yml`)");
    expect(claude).toContain("only for a rollback or when the workflow is broken");
    expect(claude).toMatch(/never push to `production` unless the user asks/);
    expect(claude).not.toContain("Nothing deploys by itself");
    const readme = read("deploy/README.md");
    for (const part of ["## Automatic deploys", "### One-time setup", "## Deploying by hand (the fallback)", "DEPLOY_SSH_KEY", "DEPLOY_KNOWN_HOSTS", "SUPABASE_DB_URL", "TELEGRAM_BOT_TOKEN", "deploy-gate", 'restrict,command="/home/a1mirr/bin/deploy-gate"', "dry_run", "baseline", "0024_friends.sql"]) {
      expect(readme, part).toContain(part);
    }
  });
});

// The gate script is the forced command of the deploy key. Run it for real wherever a POSIX shell and git exist
// (Linux and the CI runners; Git Bash on Windows).
const hasShell = spawnSync("sh", ["-c", "command -v git-upload-pack >/dev/null && command -v git-receive-pack >/dev/null"]).status === 0;

describe("spec 0026 AC-7: deploy/ssh-gate.sh", () => {
  const gate = fileURLToPathSafe(new URL("../deploy/ssh-gate.sh", import.meta.url));
  const script = read("deploy/ssh-gate.sh");

  it("is a plain LF shell script that refuses by default", () => {
    expect(script.startsWith("#!/bin/sh\n")).toBe(true);
    expect(script).not.toContain("\r");
    expect(script).toMatch(/^set -eu$/m);
    expect(script).toMatch(/\*\)\s*\n\s+echo "deploy key: only git push and git fetch for ~\/kektura\.git are allowed here\." >&2\s*\n\s+exit 1/);
    expect(script).not.toMatch(/\beval\b|\$SSH_ORIGINAL_COMMAND\b(?!:-)/); // the command is matched, never executed
  });

  describe.skipIf(!hasShell)("run for real", () => {
    // A server home with a bare repository holding one commit on main.
    function serverHome() {
      const home = fs.mkdtempSync(path.join(os.tmpdir(), "gate-"));
      const repo = path.join(home, "kektura.git");
      for (const args of [["init", "--bare", "-b", "main", repo]]) spawnSync("git", args);
      const work = fs.mkdtempSync(path.join(os.tmpdir(), "gate-work-"));
      const git = (...args: string[]) => spawnSync("git", ["-C", work, "-c", "user.name=t", "-c", "user.email=t@t", ...args], { encoding: "utf8" });
      git("init", "-b", "main");
      fs.writeFileSync(path.join(work, "a.txt"), "a");
      git("add", "a.txt");
      git("commit", "-m", "first");
      git("push", repo, "main");
      return home;
    }
    const gateRun = (home: string, command: string | undefined, input = "0000") =>
      spawnSync("sh", [gate], { input, encoding: "utf8", env: { ...process.env, HOME: home, ...(command === undefined ? { SSH_ORIGINAL_COMMAND: undefined } : { SSH_ORIGINAL_COMMAND: command }) } as NodeJS.ProcessEnv });

    it.each(["~/kektura.git", "/home/a1mirr/kektura.git", "kektura.git"])("lets git read the refs of %s", (spelling) => {
      const home = serverHome();
      const result = gateRun(home, `git-upload-pack '${spelling}'`);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toMatch(/refs\/heads\/main/); // the advertisement lists main
    });

    it.each(["~/kektura.git", "/home/a1mirr/kektura.git", "kektura.git"])("lets git push to %s (the receive side answers)", (spelling) => {
      const home = serverHome();
      const result = gateRun(home, `git-receive-pack '${spelling}'`);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toMatch(/refs\/heads\/main/);
    });

    it.each([
      ["a login shell (no command)", undefined],
      ["an empty command", ""],
      ["another command", "ls -la"],
      ["a shell", "sh"],
      ["another repository", "git-upload-pack '/etc'"],
      ["another repository, same service", "git-receive-pack 'other.git'"],
      ["a path that merely ends the same way", "git-receive-pack '../kektura.git'"],
      ["a command appended after the allowed one", "git-upload-pack '~/kektura.git'; id"],
      ["an archive request", "git-upload-archive '~/kektura.git'"],
      ["a substitution", "git-upload-pack '~/kektura.git' $(id)"],
    ])("refuses %s", (_name, command) => {
      const home = serverHome();
      const result = gateRun(home, command);
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toMatch(/only git push and git fetch for ~\/kektura\.git/);
    });
  });
});

// On Windows a file URL's pathname starts with /C:/, which a shell can't open as is.
function fileURLToPathSafe(url: URL) {
  return decodeURIComponent(url.pathname).replace(/^\/([A-Za-z]:)/, "$1");
}
