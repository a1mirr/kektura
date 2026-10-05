import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "hook-secret";
const rpc = vi.fn();
const send = vi.fn();
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => (process.env.SUPABASE_SERVICE_ROLE_KEY ? { rpc } : null) }));
vi.mock("@/lib/telegram", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/telegram")>()),
  sendTelegramMessage: (...args: unknown[]) => send(...args),
}));

// A fresh module per test: the duplicate memory, the rate limit and the pending /confirm are module state.
async function load() {
  vi.resetModules();
  return (await import("./route")).POST;
}

let nextId = 100;
type Options = { secret?: string | null; chat?: number; from?: number; id?: number; body?: string };
function post(text: string, { secret = SECRET, chat = 42, from = 42, id = nextId++, body }: Options = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) headers["x-telegram-bot-api-secret-token"] = secret;
  return new Request("http://localhost/api/telegram", {
    method: "POST",
    headers,
    body: body ?? JSON.stringify({ update_id: id, message: { text, chat: { id: chat }, from: { id: from } } }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:token");
  vi.stubEnv("TELEGRAM_CHAT_ID", "42");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  send.mockResolvedValue({ ok: true });
  rpc.mockImplementation(async (fn: string) => ({
    data: fn === "admin_list_feature_flags" ? [{ key: "friends", mode: "on", users: 0 }] : "ok",
    error: null,
  }));
});

describe("spec 0035: the Telegram webhook", () => {
  it("AC-14: without the right secret header, or without the secret configured, it is an empty 404 and does nothing", async () => {
    const POST = await load();
    for (const secret of [null, "", "wrong", SECRET.toUpperCase()]) {
      const response = await POST(post("/flags", { secret }));
      expect([response.status, await response.text()], String(secret)).toEqual([404, ""]);
    }
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "");
    expect((await POST(post("/flags", { secret: "" }))).status).toBe(404);
    expect((await POST(post("/flags"))).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("AC-14: without the bot configured it is a 404 too", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    expect((await (await load())(post("/flags"))).status).toBe(404);
  });

  it("AC-15: a message from anybody but the owner gets no answer and changes nothing", async () => {
    const POST = await load();
    for (const who of [{ chat: 43, from: 43 }, { chat: 42, from: 43 }, { chat: 43, from: 42 }]) {
      expect((await POST(post("/flag friends off", who))).status).toBe(200);
    }
    expect(rpc).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("AC-16, AC-22: the owner's command is answered with 200, after the database accepted it, to the owner's chat", async () => {
    const POST = await load();
    const order: string[] = [];
    rpc.mockImplementation(async () => {
      order.push("database");
      return { data: "ok", error: null };
    });
    send.mockImplementation(async () => {
      order.push("answer");
      return { ok: true };
    });
    const response = await POST(post("/flag friends off"));
    expect(response.status).toBe(200);
    expect(order).toEqual(["database", "answer"]);
    expect(rpc).toHaveBeenCalledWith("admin_set_feature_flag", { p_key: "friends", p_mode: "off" });
    expect(send).toHaveBeenCalledWith("friends is now off.", expect.objectContaining({ chatId: "42", token: "123:token" }));
  });

  it("AC-16: an update id that was handled is ignored the second time", async () => {
    const POST = await load();
    expect((await POST(post("/flag friends off", { id: 5 }))).status).toBe(200);
    expect((await POST(post("/flag friends off", { id: 5 }))).status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("AC-16: a body that is too big, not JSON or without a text message is ignored with a 200", async () => {
    const POST = await load();
    const big = JSON.stringify({ update_id: 1, message: { text: "x".repeat(20_000), chat: { id: 42 }, from: { id: 42 } } });
    for (const body of ["not json", big, JSON.stringify({ update_id: 2, message: { chat: { id: 42 }, from: { id: 42 } } }), "[]"]) {
      expect((await POST(post("", { body }))).status).toBe(200);
    }
    expect(send).not.toHaveBeenCalled();
  });

  it("AC-16: a database failure or a failing Telegram never turns into anything but a 200", async () => {
    const POST = await load();
    rpc.mockRejectedValue(new Error("down"));
    send.mockRejectedValue(new Error("network"));
    expect((await POST(post("/flag friends off"))).status).toBe(200);
    expect(send).toHaveBeenCalledWith(expect.stringMatching(/^Failed/), expect.anything());
  });

  it("AC-22: without the service role key the owner is told the commands are not configured", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const POST = await load();
    expect((await POST(post("/flags"))).status).toBe(200);
    expect(send).toHaveBeenCalledWith(expect.stringMatching(/not configured/), expect.anything());
    expect(rpc).not.toHaveBeenCalled();
  });

  it("AC-20: /confirm completes a pending switch to on across two requests", async () => {
    const POST = await load();
    await POST(post("/flag friends on"));
    expect(rpc).not.toHaveBeenCalled();
    await POST(post("/confirm"));
    expect(rpc).toHaveBeenCalledWith("admin_set_feature_flag", { p_key: "friends", p_mode: "on" });
  });

  it("AC-25: more than 30 commands in a minute are ignored", async () => {
    const POST = await load();
    for (let i = 0; i < 35; i++) await POST(post("/flags"));
    expect(send).toHaveBeenCalledTimes(30);
  });

  it("AC-24: the log lines never hold the secret, the token, the key or the email", async () => {
    const POST = await load();
    await POST(post("/allow friends ana@example.com"));
    const logged = JSON.stringify([...vi.mocked(console.info).mock.calls, ...vi.mocked(console.error).mock.calls]);
    expect(logged).toContain("[feature-flags] change");
    for (const secret of [SECRET, "123:token", "service-key", "ana@example.com"]) expect(logged).not.toContain(secret);
  });
});
