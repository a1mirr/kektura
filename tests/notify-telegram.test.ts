// Spec 0026 AC-9: the failure message to the developer, against a fake Telegram API. The request URL contains
// the bot token, so what must never appear in any output is the token itself.
import { spawn } from "node:child_process";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { failureMessage } from "../scripts/lib/deploy.mjs";
import { notify } from "../scripts/notify-telegram.mjs";

const TOKEN = "123456:secret-token-value";
const SHA = "0123456789abcdef0123456789abcdef01234567";
const RUN = "https://github.com/a1mirr/kektura/actions/runs/42";

let server: http.Server | undefined;
const received: { url: string; body: Record<string, unknown> }[] = [];

async function fakeTelegram(answer: { status: number; json: object }) {
  server = http.createServer((request, response) => {
    let data = "";
    request.on("data", (chunk) => (data += chunk));
    request.on("end", () => {
      received.push({ url: request.url ?? "", body: JSON.parse(data || "{}") });
      response.statusCode = answer.status;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(answer.json));
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

describe("spec 0026 AC-9: the failure message", () => {
  it("names the commit, the failed step and the run", () => {
    const text = failureMessage({ sha: SHA, runUrl: RUN, outcomes: { plan: "success", migrate: "failure", push: "skipped", smoke: "skipped" } });
    expect(text).toContain("0123456");
    expect(text).not.toContain(SHA); // short sha only
    expect(text).toContain("applying migrations");
    expect(text).toContain(RUN);
    expect(text).toMatch(/Nothing was rolled back by itself/);
  });

  it.each([
    [{ pick: "failure" }, "choosing the commit to deploy"],
    [{ ci: "failure" }, "checking that CI passed"],
    [{ plan: "failure" }, "reaching production"],
    [{ plan: "success", migrate: "success", push: "failure" }, "pushing the code to production"],
    [{ plan: "success", migrate: "success", push: "success", smoke: "failure" }, "the smoke test"],
    [{}, "an unknown step"],
  ])("%j fails in: %s", (outcomes, step) => {
    expect(failureMessage({ sha: SHA, runUrl: RUN, outcomes })).toContain(step);
  });

  it("is sent to the chat through sendMessage, as plain text", async () => {
    const base = await fakeTelegram({ status: 200, json: { ok: true } });
    const text = failureMessage({ sha: SHA, runUrl: RUN, outcomes: { push: "failure" } });
    expect(await notify({ token: TOKEN, chatId: "42", text, base })).toBe("sent");
    expect(received).toHaveLength(1);
    expect(received[0].url).toBe(`/bot${TOKEN}/sendMessage`);
    expect(received[0].body).toMatchObject({ chat_id: "42", text, disable_web_page_preview: true });
    expect(received[0].body).not.toHaveProperty("parse_mode");
  });

  it("sends nothing when the bot is not configured", async () => {
    const base = await fakeTelegram({ status: 200, json: { ok: true } });
    expect(await notify({ token: "", chatId: "42", text: "x", base })).toBe("skipped");
    expect(await notify({ token: TOKEN, chatId: undefined, text: "x", base })).toBe("skipped");
    expect(received).toEqual([]);
  });

  it("reports a refusal by Telegram without the token", async () => {
    const base = await fakeTelegram({ status: 400, json: { ok: false, description: "Bad Request: chat not found" } });
    const result = await notify({ token: TOKEN, chatId: "42", text: "x", base });
    expect(result).toBe("Telegram refused the message: Bad Request: chat not found");
    expect(result).not.toContain(TOKEN);
  });

  it("reports an unreachable Telegram without the token or the URL", async () => {
    const result = await notify({ token: TOKEN, chatId: "42", text: "x", base: "http://127.0.0.1:1" });
    expect(result).toMatch(/^Could not reach Telegram \(\w+\)$/);
    expect(result).not.toContain(TOKEN);
    expect(result).not.toContain("127.0.0.1");
  });

  it("as a script: sends the message built from the workflow's variables, and prints no token", async () => {
    const base = await fakeTelegram({ status: 200, json: { ok: true } });
    const env = {
      ...process.env,
      TELEGRAM_BOT_TOKEN: TOKEN,
      TELEGRAM_CHAT_ID: "42",
      TELEGRAM_API_BASE: base,
      DEPLOY_SHA: SHA,
      RUN_URL: RUN,
      CI_OUTCOME: "skipped",
      PLAN_OUTCOME: "success",
      MIGRATE_OUTCOME: "success",
      PUSH_OUTCOME: "success",
      SMOKE_OUTCOME: "failure",
    };
    // Not spawnSync: that would block this process, and the fake server could not answer.
    const result = await new Promise<{ status: number | null; output: string }>((resolve) => {
      const child = spawn(process.execPath, ["scripts/notify-telegram.mjs"], { env });
      let output = "";
      child.stdout.on("data", (chunk) => (output += chunk));
      child.stderr.on("data", (chunk) => (output += chunk));
      child.on("close", (status) => resolve({ status, output }));
    });
    expect(result.status).toBe(0);
    expect(result.output).toContain("Telegram: sent");
    expect(result.output).not.toContain(TOKEN);
    expect(received).toHaveLength(1);
    expect(received[0].url).toBe(`/bot${TOKEN}/sendMessage`);
    expect(String(received[0].body.text)).toContain("the smoke test");
    expect(String(received[0].body.text)).toContain("0123456");
  });

  it("as a script without the bot: says so, exits 0 and sends nothing", async () => {
    const base = await fakeTelegram({ status: 200, json: { ok: true } });
    const env: NodeJS.ProcessEnv = { ...process.env, TELEGRAM_API_BASE: base, DEPLOY_SHA: SHA, RUN_URL: RUN };
    delete env.TELEGRAM_BOT_TOKEN;
    delete env.TELEGRAM_CHAT_ID;
    const result = await new Promise<{ status: number | null; output: string }>((resolve) => {
      const child = spawn(process.execPath, ["scripts/notify-telegram.mjs"], { env });
      let output = "";
      child.stdout.on("data", (chunk) => (output += chunk));
      child.on("close", (status) => resolve({ status, output }));
    });
    expect(result.status).toBe(0);
    expect(result.output).toMatch(/Telegram is not configured/);
    expect(received).toEqual([]);
  });
});
