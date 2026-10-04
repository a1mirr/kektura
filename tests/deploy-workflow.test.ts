// Spec 0026: the properties of the deploy workflow that keep production safe, so a later edit can't remove them
// unnoticed. The workflow itself only runs on GitHub; the scripts it calls have their own tests.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const hasBash = spawnSync("bash", ["-c", "true"]).status === 0;
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
        "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'", // by hand: from main only
        "github.event.workflow_run.conclusion == 'success'",
        "github.event.workflow_run.event == 'push'",
        "github.event.workflow_run.head_branch == 'main'",
        "github.event.workflow_run.head_repository.full_name == github.repository",
      ]) {
        expect(condition, part).toContain(part);
      }
    });

    it("never reacts to pull requests, and works from the history of main (the commit is picked and checked out in the Pick step)", () => {
      const triggers = workflow.slice(workflow.indexOf("\non:"), workflow.indexOf("\npermissions:"));
      expect(triggers).not.toMatch(/pull_request/);
      expect(triggers).not.toMatch(/^ {2}push:/m);
      expect(step("Notice when the secrets are missing")).toBeTruthy();
      expect(workflow).not.toMatch(/^\s+ref:/m); // no pinned ref: the tip of main, with its whole history
      expect(workflow).toContain("fetch-depth: 0");
      expect(workflow).toContain("persist-credentials: false");
    });
  });

  describe("AC-2: one deploy at a time", () => {
    it("the deploy job has the concurrency group, nothing is cancelled for it, and a dry run has a group of its own", () => {
      expect(workflow).toMatch(/^ {4}concurrency:\s*\n {6}group: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.dry_run && 'deploy-dry-run' \|\| 'deploy' \}\}\s*\n {6}cancel-in-progress: false/m);
    });

    it("deploys the newest commit of main whose CI passed, whichever waiting run survives or finishes first", () => {
      const pick = step("Pick the commit to deploy");
      expect(pick).toContain("id: pick");
      expect(pick).toContain('gh run list --repo "$GITHUB_REPOSITORY" --workflow CI --branch main --event push --status success --limit 1');
      expect(pick).toContain("--json headSha");
      expect(pick).toContain('git merge-base --is-ancestor "$sha" HEAD'); // part of main's history
      // migrations, scripts and the pushed code all come from that one commit, not from the tip of main
      expect(pick.indexOf('git checkout --detach "$sha"')).toBeGreaterThan(pick.indexOf("git merge-base --is-ancestor"));
      expect(pick.indexOf('git checkout --detach "$sha"')).toBeLessThan(pick.indexOf('echo "TARGET_SHA=$sha"'));
      expect(pick).toContain('echo "TARGET_SHA=$sha" >> "$GITHUB_ENV"');
      expect(pick).toContain('sha="$GITHUB_SHA"'); // by hand: the tip of main (CI is checked in the next step)
      expect(workflow).not.toMatch(/^ {6}TARGET_SHA:/m); // not fixed by the run that started the workflow
      const order = ["- name: Pick the commit to deploy", "- name: Check that CI passed on this commit", "- name: Reach production and decide what to deploy"].map((name) => workflow.indexOf(name));
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it("the group is on the job, not the workflow: a run whose job is skipped must not take a waiting deploy's place", () => {
      expect(workflow).not.toMatch(/^concurrency:/m);
      expect(workflow.indexOf("    concurrency:")).toBeGreaterThan(workflow.indexOf("\njobs:"));
    });
  });

  describe("task 0038: the reads of GitHub's API retry before they fail the deploy (no AC states this; AC-9 still holds: a real failure fails the run)", () => {
    // The helper is written to a file by its own step; this is that file, as the shell will see it.
    const helper = () => {
      const text = step("Define the retry helper for GitHub API calls");
      const body = /<<'EOF'\n([\s\S]*?)\n {10}EOF/.exec(text)![1];
      return body.replace(/^ {10}/gm, "");
    };
    // Runs `gh_retry gh ...` with a stub `gh` that fails `failures` times (exit 22, after printing "partial" on stdout
    // and a 504 on stderr) and then prints "ok", and a stub `sleep` that only records its argument.
    const run = (failures: number) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retry-"));
      const slash = (p: string) => p.replace(/\\/g, "/");
      const readLines = (name: string) => {
        const file = path.join(dir, name);
        return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n") : [];
      };
      const script = [
        helper(),
        `calls=${slash(path.join(dir, "calls"))}; naps=${slash(path.join(dir, "naps"))}`,
        `gh() { echo x >> "$calls"; if [ "$(wc -l < "$calls")" -le ${failures} ]; then echo partial; echo "HTTP 504" >&2; return 22; fi; echo ok; }`,
        'sleep() { echo "$1" >> "$naps"; }',
        "set -euo pipefail",
        "out=$(gh_retry gh run list)",
        'echo "out=$out"',
      ].join("\n");
      const result = spawnSync("bash", ["-c", script], { encoding: "utf8" });
      return { status: result.status, stdout: result.stdout, stderr: result.stderr, calls: readLines("calls").length, naps: readLines("naps") };
    };

    it("defines the helper once, before the first step that calls gh, and every gh call goes through it", () => {
      const define = "- name: Define the retry helper for GitHub API calls";
      expect(workflow.indexOf(define)).toBeGreaterThan(-1);
      expect(workflow.indexOf(define)).toBeLessThan(workflow.indexOf("- name: Pick the commit to deploy"));
      expect(step("Define the retry helper for GitHub API calls")).toContain("if: env.CONFIGURED == 'true'");
      const code = lines.filter((line) => !line.trim().startsWith("#"));
      const calls = code.filter((line) => /(^|[\s($`])gh\s/.test(line));
      expect(calls.length).toBeGreaterThanOrEqual(2); // the pick and the CI check
      for (const line of calls) expect(line, line).toMatch(/gh_retry gh /);
      for (const name of ["Pick the commit to deploy", "Check that CI passed on this commit"]) {
        expect(step(name), name).toContain('source "$RUNNER_TEMP/gh-retry.sh"');
      }
    });

    describe.skipIf(!hasBash)("the helper, run for real with a stub gh", () => {
      it("a call that works the first time runs once and does not pause", () => {
        const result = run(0);
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout).toBe("out=ok\n");
        expect(result.calls).toBe(1);
        expect(result.naps).toEqual([]);
      });

      it("recovers from transient failures, pausing a little longer each time, and passes on only the output that worked", () => {
        const result = run(3);
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout).toBe("out=ok\n"); // not the "partial" that a failed attempt printed
        expect(result.calls).toBe(4);
        expect(result.naps).toEqual(["5", "10", "15"]);
        expect(result.stderr).toContain("::warning title=GitHub API call failed::Attempt 1 of 4 failed");
      });

      it("a real failure still fails: after the fourth attempt it exits with that attempt's code and passes on no output", () => {
        const result = run(99);
        expect(result.status).toBe(22);
        expect(result.stdout).toBe("");
        expect(result.calls).toBe(4);
        expect(result.naps).toEqual(["5", "10", "15"]); // no pause after the last attempt
        expect(result.stderr).toContain("HTTP 504");
      });
    });
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

    it("a run by hand that changes something needs a passed CI run on that commit, as a merge does", () => {
      const ci = step("Check that CI passed on this commit");
      expect(ci).toContain("id: ci");
      expect(ci).toContain("github.event_name == 'workflow_dispatch'");
      expect(ci).toContain("env.DRY_RUN != 'true'");
      expect(ci).toContain('gh run list --repo "$GITHUB_REPOSITORY" --workflow CI --commit "$TARGET_SHA"');
      expect(ci).toContain('select(.conclusion == "success")');
      expect(ci).toContain("exit 1");
      expect(workflow.indexOf("- name: Check that CI passed on this commit")).toBeLessThan(workflow.indexOf("- name: Reach production and decide what to deploy"));
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
      const code = lines.filter((line) => !line.trim().startsWith("#")).join("\n"); // comments may talk about `git push`
      expect(code.match(/git push/g)).toHaveLength(1);
    });

    it("the migration step has a timeout too: a lock that never frees must fail the step, not cancel the job", () => {
      const minutes = Number(/timeout-minutes: (\d+)/.exec(step("Apply the missing migrations"))![1]);
      expect(minutes).toBeGreaterThanOrEqual(5);
      expect(minutes).toBeLessThan(Number(/^ {4}timeout-minutes: (\d+)/m.exec(workflow)![1]));
    });

    it("has its own timeout, so a build that hangs fails the step and still reaches the failure message", () => {
      expect(step("Push the code to production")).toMatch(/timeout-minutes: (\d+)/);
      const minutes = Number(/timeout-minutes: (\d+)/.exec(step("Push the code to production"))![1]);
      const job = Number(/^ {4}timeout-minutes: (\d+)/m.exec(workflow)![1]);
      expect(minutes).toBeGreaterThanOrEqual(10); // the build takes minutes on this server
      expect(minutes).toBeLessThan(job);
    });

    it("counts the push only when the server's hook reports it deployed this commit (git push exits 0 when the hook fails)", () => {
      const push = step("Push the code to production");
      expect(push).toContain('2>&1 | tee "$RUNNER_TEMP/push.log"');
      expect(push).toMatch(/if ! grep -Eq "remote: Deployed \$\{TARGET_SHA:0:7\}\[0-9a-f\]\*\\\." "\$RUNNER_TEMP\/push\.log"; then/);
      expect(push).toMatch(/exit 1\n\s+fi\n\s+echo "### Deployed"/); // the summary says "Deployed" only after the check
      // ... and the hook prints exactly that line when it is done
      expect(read("deploy/post-receive")).toContain('echo "Deployed $(git --git-dir="$GIT_DIR" rev-parse --short main)."');
    });

    describe.skipIf(!hasBash)("the check, run for real on hook output", () => {
      const grepLine = () => /grep -Eq "remote: Deployed[^\n]*push\.log"/.exec(step("Push the code to production"))![0];
      const run = (log: string, sha: string) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "push-"));
        fs.writeFileSync(path.join(dir, "push.log"), log);
        return spawnSync("bash", ["-c", grepLine()], { env: { ...process.env, TARGET_SHA: sha, RUNNER_TEMP: dir.replace(/\\/g, "/") } }).status;
      };
      const SHA = "0123456abcdef0123456789abcdef01234567890";

      it("passes when the hook says it deployed this commit (abbreviation of any length)", () => {
        expect(run("remote: Building Next.js app...\nremote: Deployed 0123456.\nTo host:~/kektura.git\n", SHA)).toBe(0);
        expect(run("remote: Deployed 0123456abc.\n", SHA)).toBe(0);
      });

      it("fails when the hook stopped before saying so (a failed install or build), or deployed another commit", () => {
        expect(run("remote: Installing dependencies...\nremote: npm ERR! ...\nTo host:~/kektura.git\n   a..b  x -> main\n", SHA)).toBe(1);
        expect(run("remote: Deployed 9999999.\n", SHA)).toBe(1);
        expect(run("Everything up-to-date\n", SHA)).toBe(1);
      });
    });

    it("authenticates with the deploy key, a pinned host key and no prompt", () => {
      const setup = step("Set up the deploy key");
      expect(setup).toContain("StrictHostKeyChecking=yes");
      expect(setup).toContain("| tr -d '\\r' > ~/.ssh/deploy_key"); // a key pasted from Windows may carry carriage returns
      expect(setup).toContain("| tr -d '\\r' > ~/.ssh/known_hosts");
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
      for (const id of ["pick", "ci", "plan", "missing", "backup", "migrate", "push", "smoke"]) expect(failure).toContain(`steps.${id}.outcome`);
      expect(failure).toContain("DEPLOY_SHA: ${{ env.TARGET_SHA ||");
      expect(failure).toMatch(/rebuild on the server by hand/); // a push whose build failed can't be re-run
    });

    it("names the steps the failure message refers to", () => {
      for (const id of ["pick", "ci", "plan", "missing", "backup", "migrate", "push", "smoke"]) expect(workflow).toContain(`id: ${id}`);
    });
  });

  describe("AC-10: secrets are only referenced in a step's env, never printed; contents are read-only", () => {
    it("has read-only permissions only: the contents, and the list of CI runs", () => {
      expect(workflow).toMatch(/^permissions:\n {2}contents: read\n {2}actions: read[^\n]*\n\n/m);
      expect(workflow).not.toMatch(/: write\b/);
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
      for (const name of ["Pick the commit to deploy", "Set up the deploy key", "Reach production and decide what to deploy", "Apply the missing migrations", "Push the code to production", "Check that the site answers"]) {
        expect(step(name), name).toContain("env.CONFIGURED == 'true'");
      }
    });
  });

  describe("AC-14: the user data is backed up right before the first missing migration, and a failed backup stops the deploy", () => {
    const code = lines.filter((line) => !line.trim().startsWith("#")).join("\n");

    it("AC-14: finds out whether a migration is missing with the migration script's own dry run, after the plan and before anything is applied", () => {
      const missing = step("Find out whether a migration is missing");
      expect(missing).toContain("id: missing");
      expect(missing).toContain("args=(--dry-run)");
      expect(missing).toContain('if [ -n "$BASELINE" ]; then args+=(--baseline "$BASELINE"); fi'); // a first run with a baseline would be refused without it
      expect(missing).toContain('node scripts/migrate-production.mjs "${args[@]}"');
      expect(missing).toContain("env -u GITHUB_STEP_SUMMARY"); // the step that applies writes the summary section
      expect(missing).toContain("SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}");
      expect(missing).toContain("env.CONFIGURED == 'true' && (steps.plan.outputs.deploy == 'true' || env.BASELINE != '')"); // when the migrations step runs
      expect(missing).not.toContain("DRY_RUN"); // a dry run of the deploy asks too, to say whether a dump would be taken
      expect(missing).toMatch(/timeout-minutes: \d+/);
    });

    it("AC-14: the dump step comes after the plan and before the migration step", () => {
      const order = ["Reach production and decide what to deploy", "Find out whether a migration is missing", "Back up the user data before migrating", "Apply the missing migrations", "Push the code to production"].map((name) =>
        workflow.indexOf(`- name: ${name}`),
      );
      expect(order.every((position) => position > -1)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it("AC-14: the dump runs only when a migration is missing, never in a dry run, and is stored as pre-migration-<sha7> for 30 days", () => {
      const backup = step("Back up the user data before migrating");
      expect(backup).toContain("id: backup");
      expect(backup).toContain("if: env.CONFIGURED == 'true' && steps.missing.outputs.missing == 'true' && env.DRY_RUN != 'true'");
      expect(backup).toContain("uses: ./.github/actions/dump-user-data");
      expect(backup).toContain("artifact-name: pre-migration-${{ env.TARGET_SHA7 }}");
      expect(backup).toContain("retention-days: 30");
      expect(backup).toMatch(/timeout-minutes: \d+/); // a hang fails the step, which still reaches the failure message
      // the short sha is set where the commit is picked, from the same commit
      expect(step("Pick the commit to deploy")).toContain('echo "TARGET_SHA7=${sha:0:7}" >> "$GITHUB_ENV"');
    });

    it("AC-14: the connection string reaches the dump through the step's env, and the only secrets the workflow gives to steps stay in env lines", () => {
      const backup = step("Back up the user data before migrating");
      expect(backup).toMatch(/env:\s*\n\s+SUPABASE_DB_URL: \$\{\{ secrets\.SUPABASE_DB_URL \}\}/);
      expect(backup).toContain("db-url: ${{ env.SUPABASE_DB_URL }}");
      expect(backup).not.toMatch(/echo|run:/);
    });

    it("AC-14: a dry run says that a dump would be taken and takes none", () => {
      const say = step("Say that a backup would be taken");
      expect(say).toContain("steps.missing.outputs.missing == 'true' && env.DRY_RUN == 'true'");
      expect(say).toContain("would be taken");
      expect(say).not.toContain("uses:");
      expect(say).not.toContain("secrets.");
      expect(workflow.match(/uses: \.\/\.github\/actions\/dump-user-data/g)).toHaveLength(1); // the only dump, and it needs DRY_RUN != 'true'
    });

    it("AC-14: a dump that fails stops the chain: nothing makes the backup step optional, and no later step runs after a failure except the message", () => {
      expect(code).not.toContain("continue-on-error");
      // the migration step keeps the default `success()`: it has no status function of its own
      const migrateIf = step("Apply the missing migrations")
        .split("\n")
        .filter((line) => /^ {8}if: /.test(line));
      expect(migrateIf).toHaveLength(1);
      expect(migrateIf[0]).not.toMatch(/\b(always|failure|cancelled)\(\)/);
      // only the failure message runs after a failed step
      const conditions = lines.filter((line) => /^ {8}if: /.test(line) && /\b(always|failure|cancelled)\(\)/.test(line));
      expect(conditions).toEqual(["        if: failure()"]);
      expect(step("Tell the developer, and say how to roll back")).toContain("BACKUP_OUTCOME: ${{ steps.backup.outcome }}"); // the failure is reported like any failed step (AC-9)
      expect(step("Tell the developer, and say how to roll back")).toContain("MISSING_OUTCOME: ${{ steps.missing.outcome }}");
    });

    it("AC-14: no dump runs when no migration is missing: the backup step reads the output of the dry run and nothing else decides", () => {
      const ifs = lines.filter((line) => line.includes("steps.missing.outputs.missing"));
      expect(ifs).toHaveLength(2); // the dump and the dry-run notice
      expect(step("Find out whether a migration is missing")).toContain("--dry-run");
    });
  });

  it("AC-4: the weekly backup leaves the record table out (it is not user data, and the dump check fails on any unexpected table)", () => {
    const backup = read(".github/actions/dump-user-data/action.yml"); // the dump lives in the action, shared with the weekly run
    expect(backup).toMatch(/public\.extra_stamps public\.applied_migrations( |\n)/);
    expect(read("specs/project/0012-backups.md")).toContain("`public.applied_migrations`");
  });

  it("AC-11: CLAUDE.md and deploy/README.md describe the workflow and keep the manual way as the fallback", () => {
    const claude = read("CLAUDE.md");
    expect(claude).toContain("The merge itself deploys (spec 0026, `.github/workflows/deploy.yml`)");
    expect(claude).toContain("only for a rollback or when the workflow is broken");
    expect(claude).toMatch(/never push to `production` unless the user asks/);
    expect(claude).toContain("insert into public.applied_migrations (file_name) values ('0031_x.sql')"); // the fallback records what it applied
    expect(claude).toContain("regenerated trail seeds (spec 0004) are not applied by the workflow");
    expect(claude).not.toContain("Nothing deploys by itself");
    const readme = read("deploy/README.md");
    for (const part of ["## Automatic deploys", "### One-time setup", "## Deploying by hand (the fallback)", "DEPLOY_SSH_KEY", "DEPLOY_KNOWN_HOSTS", "SUPABASE_DB_URL", "TELEGRAM_BOT_TOKEN", "deploy-gate", 'restrict,command="/home/a1mirr/bin/deploy-gate"', "dry_run", "baseline", "0024_friends.sql", "insert into public.applied_migrations (file_name) values ('0031_x.sql')", "post-receive", "The server did not report a deploy", "The automatic deploy does not apply seeds"]) {
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
    // Built once: these tests only read it, and spawning git for each of them is slow under load.
    const server = { home: "" };
    beforeAll(() => {
      server.home = serverHome();
    }, 60_000);
    const gateRun = (home: string, command: string | undefined, input = "0000") =>
      spawnSync("sh", [gate], { input, encoding: "utf8", env: { ...process.env, HOME: home, ...(command === undefined ? { SSH_ORIGINAL_COMMAND: undefined } : { SSH_ORIGINAL_COMMAND: command }) } as NodeJS.ProcessEnv });

    it.each(["~/kektura.git", "/home/a1mirr/kektura.git", "kektura.git"])("lets git read the refs of %s", (spelling) => {
      const home = server.home;
      const result = gateRun(home, `git-upload-pack '${spelling}'`);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toMatch(/refs\/heads\/main/); // the advertisement lists main
    });

    it.each(["~/kektura.git", "/home/a1mirr/kektura.git", "kektura.git"])("lets git push to %s (the receive side answers)", (spelling) => {
      const home = server.home;
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
      const home = server.home;
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
