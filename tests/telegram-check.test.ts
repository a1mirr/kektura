// Spec 0017 AC-9: `npm run telegram:check` (scripts/telegram-check.mjs) against a fake Telegram API on localhost.
import { spawn } from "node:child_process";
import http from "node:http";
import os from "node:os";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SECRET = "123456:SECRET-TOKEN";
const script = fileURLToPath(new URL("../scripts/telegram-check.mjs", import.meta.url));

let server: http.Server;
let base: string;
let updates: unknown[] = [];
const received: { method: string; body: Record<string, unknown> }[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const match = /^\/bot([^/]+)\/(\w+)$/.exec(req.url ?? "");
      res.setHeader("content-type", "application/json");
      if (!match || match[1] !== SECRET) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ ok: false, description: "Unauthorized" }));
      }
      received.push({ method: match[2], body: raw ? JSON.parse(raw) : {} });
      const result = match[2] === "getMe" ? { username: "kektura_test_bot" } : match[2] === "getUpdates" ? updates : {};
      res.end(JSON.stringify({ ok: true, result }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

// Runs the script in an empty directory (so no .env.local is read) with exactly the given environment.
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

describe("spec 0017: npm run telegram:check", () => {
  it("AC-9: checks the token, sends a test message to the chat and never prints the token", async () => {
    received.length = 0;
    const { code, out } = await run({ TELEGRAM_BOT_TOKEN: SECRET, TELEGRAM_CHAT_ID: "42" });
    expect(code).toBe(0);
    expect(out).toContain("Token OK: the bot is @kektura_test_bot.");
    expect(out).toContain("Test message sent");
    expect(received.map((r) => r.method)).toEqual(["getMe", "sendMessage"]);
    expect(received[1].body.chat_id).toBe("42");
    expect(out).not.toContain(SECRET);
  });

  it("AC-9: --find-chat-id lists the chats that wrote to the bot, or says to write to it first", async () => {
    updates = [{ message: { chat: { id: 777, type: "private", first_name: "Dani" } } }];
    const found = await run({ TELEGRAM_BOT_TOKEN: SECRET }, "--find-chat-id");
    expect(found.code).toBe(0);
    expect(found.out).toMatch(/777\s+private\s+Dani/);

    updates = [];
    const none = await run({ TELEGRAM_BOT_TOKEN: SECRET }, "--find-chat-id");
    expect(none.code).toBe(1);
    expect(none.out).toContain("No chats yet");
  });

  it("AC-9: a bad token, a missing token, a missing chat id and an unreachable API each fail with a message and exit code 1", async () => {
    const bad = await run({ TELEGRAM_BOT_TOKEN: "0:wrong", TELEGRAM_CHAT_ID: "42" });
    expect(bad.code).toBe(1);
    expect(bad.out).toContain("Telegram refused getMe: Unauthorized");
    expect(bad.out).not.toContain("wrong");

    const noToken = await run({ TELEGRAM_CHAT_ID: "42" });
    expect(noToken.code).toBe(1);
    expect(noToken.out).toContain("TELEGRAM_BOT_TOKEN is not set");

    const noChat = await run({ TELEGRAM_BOT_TOKEN: SECRET });
    expect(noChat.code).toBe(1);
    expect(noChat.out).toContain("TELEGRAM_CHAT_ID is not set");

    const unreachable = await run({ TELEGRAM_BOT_TOKEN: SECRET, TELEGRAM_CHAT_ID: "42", TELEGRAM_API_BASE: "http://127.0.0.1:9" });
    expect(unreachable.code).toBe(1);
    expect(unreachable.out).toContain("Could not reach Telegram");
    expect(unreachable.out).not.toContain(SECRET);
  });
});
