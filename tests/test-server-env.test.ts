// The test server's environment (spec 0006 AC-7): tests must never reach the developer's real Telegram.
// Next merges `.env.local` into a server's environment, so this runs Next's own env loader in a child
// process against a `.env.local` that holds a bot, as `npm run dev:test` and `npm run e2e` would.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { telegramConfig } from "@/lib/telegram";
import { testServerEnv } from "../scripts/lib/test-server-env.mjs";

const local = { API_URL: "http://127.0.0.1:54321", ANON_KEY: "anon" };
// `@next/env` is Next's own dependency, so it is found from Next's folder, not from this project's.
const nextEnvModule = createRequire(createRequire(import.meta.url).resolve("next/package.json")).resolve("@next/env");

let projectDir: string;
beforeAll(() => {
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "kektura-test-env-"));
  fs.writeFileSync(path.join(projectDir, ".env.local"), "TELEGRAM_BOT_TOKEN=123:real-token\nTELEGRAM_CHAT_ID=4242\n");
});
afterAll(() => fs.rmSync(projectDir, { recursive: true, force: true }));

// What a Next server started with `base` as its environment ends up with after it loads `.env.local`.
function loadedByNext(base: Record<string, string | undefined>): Record<string, string | undefined> {
  const script = `
    require(${JSON.stringify(nextEnvModule)}).loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
    process.stdout.write(JSON.stringify(process.env));
  `;
  // Vitest runs with NODE_ENV=test, for which Next skips .env.local; `next start` and `next dev` don't.
  const env = { ...base, NODE_ENV: "production" } as NodeJS.ProcessEnv;
  return JSON.parse(execFileSync(process.execPath, ["-e", script], { cwd: projectDir, env, encoding: "utf8" }));
}

const withoutTelegram = () => Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("TELEGRAM_")));

describe("spec 0006: test server environment", () => {
  it("AC-7: control: a server started without the blanking would read the real bot from .env.local", () => {
    expect(telegramConfig(loadedByNext(withoutTelegram()))).toMatchObject({ token: "123:real-token", chatId: "4242" });
  });

  it("AC-7: the test server sends no Telegram notifications, even though .env.local holds the bot", () => {
    const loaded = loadedByNext(testServerEnv(withoutTelegram(), local, true));
    expect(telegramConfig(loaded)).toBeNull();
  });

  it("AC-7: blanks the secrets also when they come from the shell environment", () => {
    const shell = { ...withoutTelegram(), TELEGRAM_BOT_TOKEN: "999:shell", TELEGRAM_CHAT_ID: "1" };
    expect(telegramConfig(loadedByNext(testServerEnv(shell, local, false)))).toBeNull();
  });

  // The script itself needs Docker (`supabase status`), so it can't run here: this keeps it from going back
  // to an inline environment that skips the blanking.
  it("AC-7: scripts/test-env.mjs builds the server's environment with testServerEnv and starts the server with it", () => {
    const script = fs.readFileSync(new URL("../scripts/test-env.mjs", import.meta.url), "utf8");
    expect(script).toMatch(/\benv = testServerEnv\(process\.env, local, e2e\)/);
    expect(script).toMatch(/\bspawn\(.*\benv\b.*\);/);
  });

  it("AC-7: the rest of the test server's environment is unchanged: local Supabase, dummy login, own build folder", () => {
    expect(testServerEnv({ KEEP: "me" }, local, true)).toMatchObject({
      KEEP: "me",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      TEST_LOGIN: "1",
      NEXT_DIST_DIR: ".next-e2e",
    });
    expect(testServerEnv({}, local, false).NEXT_DIST_DIR).toBe(".next-test");
  });
});
