import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";
import { checkOnce, LANGUAGES, smoke, Problem } from "../scripts/smoke-test.mjs";

type Answers = Record<string, number>;

let server: http.Server | undefined;
const requests: string[] = [];
const methods: string[] = [];
// every language's page, the unknown route and the dummy login
const CHECKS_PER_ROUND = LANGUAGES.length + 2;

async function serve(answers: Answers, beforeReady = 0) {
  let served = 0;
  server = http.createServer((request, response) => {
    requests.push(request.url ?? "");
    methods.push(request.method ?? "");
    const failing = served++ < beforeReady * CHECKS_PER_ROUND;
    response.statusCode = failing ? 502 : (answers[request.url ?? ""] ?? 404);
    response.end("x");
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
  requests.length = 0;
  methods.length = 0;
  if (server) await new Promise((resolve) => server!.close(resolve));
  server = undefined;
});

const pages = (status: number): Answers => Object.fromEntries(LANGUAGES.map((language) => [`/${language}`, status]));
const HEALTHY = pages(200);
const [firstLanguage] = LANGUAGES;
const lastLanguage = LANGUAGES.at(-1)!;
const fast = { intervalMs: 20, sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)) };

describe("spec 0026 AC-8: the smoke test", () => {
  it("AC-8: asks for every language of the site: the languages are the message files, and they are the routing's", () => {
    expect([...LANGUAGES].sort()).toEqual([...routing.locales].sort());
  });

  it("passes when every language's page answers 200 and an unknown route answers 404", async () => {
    const base = await serve(HEALTHY);
    expect(await checkOnce(base)).toEqual([]);
    expect(requests).toEqual([...LANGUAGES.map((language) => `/${language}`), "/en/smoke-test-no-such-page", "/auth/test-login"]);
  });

  it("0006 AC-4: posts to the dummy login and fails when it signs anybody in instead of answering 404", async () => {
    const open = await serve({ ...HEALTHY, "/auth/test-login": 303 });
    expect(await checkOnce(open)).toEqual(["/auth/test-login: expected 404, got 303"]);
    expect(methods.at(-1)).toBe("POST");
    expect(methods.slice(0, -1).every((method) => method === "GET")).toBe(true);
  });

  it("says which route is wrong and what it answered", async () => {
    const base = await serve({ ...HEALTHY, [`/${lastLanguage}`]: 500 });
    expect(await checkOnce(base)).toEqual([`/${lastLanguage}: expected 200, got 500`]);
  });

  it("fails when the unknown route does not answer 404 (the not-found handling is broken)", async () => {
    const base = await serve({ ...HEALTHY, "/en/smoke-test-no-such-page": 200 });
    expect(await checkOnce(base)).toEqual(["/en/smoke-test-no-such-page: expected 404, got 200"]);
  });

  it("treats a redirect as a failure instead of following it", async () => {
    const base = await serve({ ...HEALTHY, [`/${firstLanguage}`]: 301 });
    expect(await checkOnce(base)).toEqual([`/${firstLanguage}: expected 200, got 301`]);
  });

  it("reports a server that is not there at all, without the URL", async () => {
    const wrong = await checkOnce("http://127.0.0.1:1");
    expect(wrong).toHaveLength(CHECKS_PER_ROUND);
    for (const line of wrong) expect(line).toMatch(/no answer \(\w+\)$/);
    expect(wrong.join()).not.toContain("127.0.0.1");
  });

  it("retries while the reload is still going, then passes", async () => {
    const base = await serve(HEALTHY, 2);
    const log: string[] = [];
    const attempts = await smoke({ base, timeoutMs: 5_000, log: (line) => log.push(line), ...fast });
    expect(attempts).toBe(3);
    expect(log[0]).toMatch(/^Attempt 1: .*502/);
    expect(log.at(-1)).toBe("Smoke test passed on attempt 3.");
  });

  it("gives up after the timeout with a Problem naming what is wrong", async () => {
    const base = await serve({ ...HEALTHY, [`/${lastLanguage}`]: 503 });
    const error = await smoke({ base, timeoutMs: 1_000, ...fast }).catch((caught) => caught);
    expect(error).toBeInstanceOf(Problem);
    expect(error.message).toContain(`did not come up healthy within 1 s: /${lastLanguage}: expected 200, got 503`);
  });

  it("stops retrying at the deadline (with a fake clock, no real waiting)", async () => {
    const base = await serve(pages(500));
    let time = 0;
    const sleeps: number[] = [];
    await expect(
      smoke({
        base,
        timeoutMs: 120_000,
        intervalMs: 5_000,
        now: () => time,
        sleep: async (ms: number) => {
          sleeps.push(ms);
          time += ms;
        },
      }),
    ).rejects.toThrow(/within 120 s/);
    expect(sleeps).toHaveLength(24); // 24 waits of 5 s fit before the 120 s deadline; the next would pass it
    expect(sleeps.every((ms) => ms === 5_000)).toBe(true);
  });
});
