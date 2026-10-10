import { spawn } from "node:child_process";
import http from "node:http";
import os from "node:os";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TOKEN = "123456:SECRET-TOKEN";
const HOOK_SECRET = "hook_secret-9";
const script = fileURLToPath(new URL("../scripts/telegram-webhook.mjs", import.meta.url));

let server: http.Server;
let base: string;
let webhook: Record<string, unknown> = {};
const received: { method: string; body: Record<string, unknown> }[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const match = /^\/bot([^/]+)\/(\w+)$/.exec(req.url ?? "");
      res.setHeader("content-type", "application/json");
      if (!match || match[1] !== TOKEN) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ ok: false, description: "Unauthorized" }));
      }
      received.push({ method: match[2], body: raw ? JSON.parse(raw) : {} });
      res.end(JSON.stringify({ ok: true, result: match[2] === "getWebhookInfo" ? webhook : true }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

function run(env: Record<string, string>, ...args: string[]) {
  return new Promise<{ code: number | null; out: string }>((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: os.tmpdir(),
      env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "", TELEGRAM_API_BASE: base, ...env },
    });
    let out = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (out += chunk));
    child.on("close", (code) => resolve({ code, out }));
  });
}

const full = { TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_WEBHOOK_SECRET: HOOK_SECRET, SITE_URL: "https://site.test/" };

describe("spec 0035: npm run telegram:webhook", () => {
  it("AC-26: set registers the site's address with the secret and for messages and taps on buttons only, and prints neither secret", async () => {
    received.length = 0;
    const { code, out } = await run(full, "set");
    expect(code).toBe(0);
    expect(out).toContain("Webhook registered for https://site.test/api/telegram.");
    expect(received).toEqual([
      { method: "setWebhook", body: { url: "https://site.test/api/telegram", secret_token: HOOK_SECRET, allowed_updates: ["message", "callback_query"] } },
    ]);
    expect(out).not.toContain(TOKEN);
    expect(out).not.toContain(HOOK_SECRET);
  });

  it("AC-26: info says where Telegram sends the messages and what went wrong, or that there is no webhook", async () => {
    webhook = { url: "https://site.test/api/telegram", pending_update_count: 2, last_error_message: "Wrong response from the webhook: 404" };
    const registered = await run(full, "info");
    expect(registered.code).toBe(0);
    expect(registered.out).toContain("Webhook registered: https://site.test/api/telegram");
    expect(registered.out).toContain("Updates waiting: 2");
    expect(registered.out).toContain("Last error from the site: Wrong response from the webhook: 404");
    webhook = {};
    expect((await run({ TELEGRAM_BOT_TOKEN: TOKEN }, "info")).out).toContain("No webhook is registered");
  });

  it("AC-26: delete removes the webhook", async () => {
    received.length = 0;
    const { code, out } = await run({ TELEGRAM_BOT_TOKEN: TOKEN }, "delete");
    expect(code).toBe(0);
    expect(out).toContain("Webhook removed.");
    expect(received.map((r) => r.method)).toEqual(["deleteWebhook"]);
  });

  it("AC-26: a missing token, secret or https address, a secret with odd characters and an unknown action each fail with a message and sent nothing", async () => {
    received.length = 0;
    const cases: [Record<string, string>, string, string][] = [
      [{ ...full, TELEGRAM_BOT_TOKEN: "" }, "set", "TELEGRAM_BOT_TOKEN is not set"],
      [{ ...full, TELEGRAM_WEBHOOK_SECRET: "" }, "set", "TELEGRAM_WEBHOOK_SECRET is not set"],
      [{ ...full, TELEGRAM_WEBHOOK_SECRET: "has space" }, "set", "may only hold"],
      [{ ...full, SITE_URL: "http://site.test" }, "set", "SITE_URL must be the public https address"],
      [{ ...full, SITE_URL: "" }, "set", "SITE_URL must be the public https address"],
      [full, "frobnicate", "Usage: npm run telegram:webhook"],
    ];
    for (const [env, action, message] of cases) {
      const result = await run(env, action);
      expect([result.code, result.out], action).toEqual([1, expect.stringContaining(message)]);
      expect(result.out).not.toContain(TOKEN);
    }
    expect(received).toEqual([]);
  });

  it("AC-26: a bad token and an unreachable API fail with a message and never print the token", async () => {
    const bad = await run({ ...full, TELEGRAM_BOT_TOKEN: "0:wrong" }, "info");
    expect(bad.code).toBe(1);
    expect(bad.out).toContain("Telegram refused getWebhookInfo: Unauthorized");
    expect(bad.out).not.toContain("wrong");
    const unreachable = await run({ ...full, TELEGRAM_API_BASE: "http://127.0.0.1:9" }, "info");
    expect(unreachable.code).toBe(1);
    expect(unreachable.out).toContain("Could not reach Telegram");
    expect(unreachable.out).not.toContain(TOKEN);
  });
});
