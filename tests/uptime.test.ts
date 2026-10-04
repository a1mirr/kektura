// Spec 0066: the uptime check. The decision and the message are plain functions; the script is run against a fake
// Telegram API (the request URL contains the bot token, so what must never appear in any output is the token); the
// workflow only runs on GitHub, so its properties are read from the file, as for the deploy and backup workflows.
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { CHECKS, checkOnce } from "../scripts/smoke-test.mjs";
import { alertMessage, shouldAlert } from "../scripts/lib/uptime.mjs";

const TOKEN = "123456:secret-token-value";
const RUN = "https://github.com/a1mirr/kektura/actions/runs/77";

const read = (file: string) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const workflow = read(".github/workflows/uptime.yml");
const lines = workflow.split("\n");
const code = lines.filter((line) => !line.trim().startsWith("#")).join("\n");

// The text of one step of the job, from its `- name:` line to the next step.
function step(name: string) {
  const start = lines.findIndex((line) => line.includes(`- name: ${name}`));
  expect(start, `a step named "${name}"`).toBeGreaterThan(-1);
  const end = lines.findIndex((line, i) => i > start && /^ {6}- /.test(line));
  return lines.slice(start, end === -1 ? undefined : end).join("\n");
}

let server: http.Server | undefined;
const received: { url: string; body: Record<string, unknown> }[] = [];

async function fakeTelegram() {
  server = http.createServer((request, response) => {
    let data = "";
    request.on("data", (chunk) => (data += chunk));
    request.on("end", () => {
      received.push({ url: request.url ?? "", body: JSON.parse(data || "{}") });
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ ok: true }));
    });
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
  received.length = 0;
  if (server) await new Promise((resolve) => server!.close(resolve));
  server = undefined;
});

// Not spawnSync: that would block this process, and the fake server could not answer.
function runScript(env: NodeJS.ProcessEnv) {
  return new Promise<{ status: number | null; output: string }>((resolve) => {
    const child = spawn(process.execPath, ["scripts/uptime-alert.mjs"], { env });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("close", (status) => resolve({ status, output }));
  });
}

describe("spec 0066: the uptime check", () => {
  describe("AC-1: a scheduled run every 15 minutes, and by hand", () => {
    it("AC-1: runs on a 15-minute schedule and by hand, and the job has a time limit", () => {
      expect(workflow).toMatch(/schedule:\s*\n\s+- cron: "\*\/15 \* \* \* \*"/);
      expect(workflow).toMatch(/^ {2}workflow_dispatch:/m);
      expect(workflow).toMatch(/^ {4}timeout-minutes: \d+/m);
    });

    it("AC-1: reacts to nothing else, and has no more rights than reading the repository and its runs", () => {
      const triggers = workflow.slice(workflow.indexOf("\non:"), workflow.indexOf("\npermissions:"));
      expect(triggers).not.toMatch(/pull_request|workflow_run/);
      expect(triggers).not.toMatch(/^ {2}push:/m);
      expect(workflow).toMatch(/^permissions:\n {2}contents: read\n {2}actions: read/m);
      expect(workflow).not.toMatch(/write/);
    });
  });

  describe("AC-2: the checks of the deploy's smoke test, against the public site", () => {
    it("AC-2: runs scripts/smoke-test.mjs against the production address, retried for a minute, and a failure fails the run", () => {
      expect(workflow).toMatch(/SITE_URL: https:\/\/kektura-tracker\.com\n/);
      const smoke = step("Check that the site answers");
      expect(smoke).toContain("id: smoke");
      expect(smoke).toContain('node scripts/smoke-test.mjs "$SITE_URL" 60');
      expect(smoke).not.toContain("continue-on-error");
      expect(read(".github/workflows/deploy.yml")).toContain('node scripts/smoke-test.mjs "$SITE_URL" 120'); // the same script, the same checks
    });

    it("AC-2: the checks are the smoke test's: a healthy site passes, and a dead one or a stray dummy login fails", async () => {
      const answer = (statuses: Record<string, number>) => async (url: URL) => ({ status: statuses[url.pathname] ?? 404, arrayBuffer: async () => new ArrayBuffer(0) });
      const healthy = Object.fromEntries(CHECKS.map((check: { path: string; status: number }) => [check.path, check.status]));
      expect(await checkOnce("https://kektura-tracker.com", answer(healthy))).toEqual([]);
      expect(await checkOnce("https://kektura-tracker.com", answer({ ...healthy, "/en": 502 }))).toEqual(["/en: expected 200, got 502"]);
      expect(await checkOnce("https://kektura-tracker.com", answer({ ...healthy, "/auth/test-login": 200 }))).toHaveLength(1);
    });
  });

  describe("AC-3: the owner is told on the second failed run in a row, once per outage", () => {
    it.each([
      ["success,success", false, "a first failure after a success is a blip"],
      ["success,failure", false, "a first failure after a recovery"],
      ["", false, "no earlier run at all: the first failure"],
      ["failure,success", true, "the second failure in a row"],
      ["failure", true, "the second failure, with only one run before it"],
      ["timed_out,success", true, "a run that timed out counts as down"],
      ["failure,failure", false, "the outage was announced two runs ago"],
      ["failure,timed_out", false, "the outage was announced two runs ago"],
      ["cancelled,success", false, "a cancelled run says nothing about the site"],
      ["skipped,failure", false, "a skipped run says nothing about the site"],
    ])("AC-3: %j gives %s (%s)", (previous, expected) => {
      expect(shouldAlert(previous)).toBe(expected);
    });

    it("AC-3: the workflow sends the message only when the site check itself failed, with the conclusions of the two runs before this one", () => {
      const tell = step("Tell the developer when this is the second failure in a row");
      expect(tell).toContain("if: failure() && steps.smoke.outcome == 'failure'");
      expect(tell).toContain('gh run list --repo "$GITHUB_REPOSITORY" --workflow uptime.yml --status completed --limit 2 --json conclusion');
      expect(tell).toContain('PREVIOUS_CONCLUSIONS="$previous" node scripts/uptime-alert.mjs');
      expect(workflow).toMatch(/^concurrency:\n {2}group: uptime\n {2}cancel-in-progress: false/m); // runs finish one by one, so "the run before" is a finished one
    });

    it("AC-3: the script sends one message through sendMessage when the rule says so, and none otherwise", async () => {
      const base = await fakeTelegram();
      const env = { ...process.env, TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: "42", TELEGRAM_API_BASE: base, RUN_URL: RUN };
      const quiet = await runScript({ ...env, PREVIOUS_CONCLUSIONS: "success,success" });
      expect(quiet.status).toBe(0);
      expect(received).toEqual([]);
      const loud = await runScript({ ...env, PREVIOUS_CONCLUSIONS: "failure,success" });
      expect(loud.status).toBe(0);
      expect(loud.output).toContain("Telegram: sent");
      expect(received).toHaveLength(1);
      expect(received[0].url).toBe(`/bot${TOKEN}/sendMessage`);
      expect(received[0].body).toMatchObject({ chat_id: "42", text: alertMessage({ runUrl: RUN }), disable_web_page_preview: true });
    });
  });

  describe("AC-4: not knowing is a reason to tell", () => {
    it("AC-4: when the earlier runs could not be read, the rule says to send", () => {
      expect(shouldAlert("unknown")).toBe(true);
      expect(shouldAlert(undefined)).toBe(true);
    });

    it("AC-4: the workflow passes `unknown` when the lookup fails", () => {
      expect(step("Tell the developer when this is the second failure in a row")).toContain("|| previous=unknown");
    });
  });

  describe("AC-5: the message names the run and nothing secret, and needs no secret", () => {
    it("AC-5: says the site is down, how, and where to look, and holds no token", () => {
      const text = alertMessage({ runUrl: RUN });
      expect(text).toContain("Production looks down");
      expect(text).toContain("two runs in a row");
      expect(text).toContain(RUN);
    });

    it("AC-5: without the bot nothing is sent and the script still exits 0; a message never prints the token", async () => {
      const base = await fakeTelegram();
      const env: NodeJS.ProcessEnv = { ...process.env, TELEGRAM_API_BASE: base, RUN_URL: RUN, PREVIOUS_CONCLUSIONS: "failure,success" };
      delete env.TELEGRAM_BOT_TOKEN;
      delete env.TELEGRAM_CHAT_ID;
      const result = await runScript(env);
      expect(result.status).toBe(0);
      expect(result.output).toMatch(/Telegram is not configured/);
      expect(received).toEqual([]);
      const sent = await runScript({ ...env, TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: "42" });
      expect(sent.output).not.toContain(TOKEN);
      expect(sent.output).not.toContain(base);
    });

    it("AC-5: the bot secrets are optional and only referenced in the env of the one step that sends, never printed", () => {
      expect(code).not.toMatch(/\bset\s+-\w*x/);
      expect(code).not.toMatch(/echo[^\n]*\$\{?TELEGRAM_/);
      const secretUses = code.split("\n").filter((line) => line.includes("secrets."));
      expect(secretUses.map((line) => line.trim())).toEqual(["TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}", "TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}"]);
      expect(step("Tell the developer when this is the second failure in a row")).toMatch(/env:[\s\S]*TELEGRAM_BOT_TOKEN:[\s\S]*TELEGRAM_CHAT_ID:/);
      expect(workflow).not.toMatch(/CONFIGURED/); // nothing is needed, so nothing is skipped
    });

    it("AC-5: the script has no way to print a token or a request URL", () => {
      const script = read("scripts/uptime-alert.mjs");
      expect(script).toContain('from "./notify-telegram.mjs"'); // the one place that sends, which prints only what Telegram answers
      expect(script).not.toMatch(/fetch\(/);
      expect(script).not.toMatch(/console\.\w+\([^)]*(TOKEN|token)/);
    });
  });
});
