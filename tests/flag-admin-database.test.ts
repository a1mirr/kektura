// Each test works on flags of its own (`dbtest-...`), never on the declared ones.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { databaseDecision, localSupabase, psql, requireDatabase } from "../e2e/local-db";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

const sent = vi.hoisted(() => [] as string[]);
const edited = vi.hoisted(() => [] as { messageId: number; text: string; callbacks: string[] }[]);
const answered = vi.hoisted(() => [] as { id: string; text: string | undefined }[]);
vi.mock("@/lib/telegram", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/telegram")>()),
  sendTelegramMessage: async (text: string) => {
    sent.push(text);
    return { ok: true };
  },
  editTelegramMessage: async (messageId: number, text: string, _config: unknown, options: { keyboard?: { callback_data: string }[][] } = {}) => {
    edited.push({ messageId, text, callbacks: (options.keyboard ?? []).flat().map((button) => button.callback_data) });
    return { ok: true };
  },
  answerTelegramCallback: async (id: string, text: string | undefined) => {
    answered.push({ id, text });
    return { ok: true };
  },
}));

const RELATIONS = ["public.feature_flags", "public.feature_flag_users"];
let local: ReturnType<typeof localSupabase> | undefined;
let service: Client;
let anon: Client;
let ana: { client: Client; id: string; email: string };
const prefix = `dbtest-${randomUUID().slice(0, 8)}`;
const flag = (suffix: string) => `${prefix}-${suffix}`;

const connect = (key: string): Client => createClient<Database>(local!.url, key, { auth: { persistSession: false } });

beforeAll(async () => {
  if (databaseDecision(RELATIONS).action !== "run") return;
  local = localSupabase();
  service = connect(local.serviceKey);
  anon = connect(local.anonKey);
  const client = connect(local.anonKey);
  const email = `Flag-Admin-${randomUUID()}@kektura.test`;
  const { data, error } = await client.auth.signUp({ email, password: "test-password-123" });
  if (error || !data.user) throw new Error(`sign-up failed: ${error?.message}`);
  ana = { client, id: data.user.id, email };
}, 60_000);

afterAll(() => {
  if (local) psql(`delete from public.feature_flags where key like '${prefix}-%'`);
});

const mode = (key: string) => psql(`select mode from public.feature_flags where key = '${key}'`);
const listed = (key: string) =>
  psql(`select count(*) from public.feature_flag_users where key = '${key}' and user_id = '${ana?.id}'`);

describe("spec 0035: the flag functions of the Telegram webhook", () => {
  it("AC-23: only the service role may call them: neither an anonymous visitor nor a signed-in user can", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    for (const who of [anon, ana.client]) {
      expect((await who.rpc("admin_list_feature_flags")).error?.code).toBe("42501");
      expect((await who.rpc("admin_set_feature_flag", { p_key: flag("a"), p_mode: "on" })).error?.code).toBe("42501");
      expect((await who.rpc("admin_set_feature_flag_user", { p_key: flag("a"), p_email: ana.email, p_allowed: true })).error?.code).toBe("42501");
      expect((await who.rpc("admin_list_feature_flag_users", { p_key: "friends" })).error?.code).toBe("42501");
      expect((await who.rpc("admin_remove_feature_flag_user", { p_key: "friends", p_user_id: ana.id })).error?.code).toBe("42501");
    }
    expect(mode(flag("a"))).toBe("");
    const functions = [
      "admin_list_feature_flags()",
      "admin_set_feature_flag(text, text)",
      "admin_set_feature_flag_user(text, text, boolean)",
      "admin_list_feature_flag_users(text)",
      "admin_remove_feature_flag_user(text, uuid)",
    ];
    for (const fn of functions) {
      const can = (role: string) => psql(`select has_function_privilege('${role}', 'public.${fn}', 'execute')`);
      expect([can("anon"), can("authenticated"), can("service_role")], fn).toEqual(["f", "f", "t"]);
    }
  }, 30_000);

  it("AC-23: they are security definer functions with an empty search_path", (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const rows = psql(
      "select prosecdef || '|' || proconfig::text from pg_proc where proname like 'admin_%feature_flag%' and pronamespace = 'public'::regnamespace",
    ).split("\n");
    expect(rows).toHaveLength(5);
    for (const row of rows) expect(row).toBe('true|{"search_path=\\"\\""}');
  });

  it("AC-23: a mode is set, creating the flag when it has no row, and setting it again changes nothing", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    expect((await service.rpc("admin_set_feature_flag", { p_key: flag("m"), p_mode: "allowlist" })).data).toBe("ok");
    expect(mode(flag("m"))).toBe("allowlist");
    expect((await service.rpc("admin_set_feature_flag", { p_key: flag("m"), p_mode: "allowlist" })).data).toBe("ok");
    expect((await service.rpc("admin_set_feature_flag", { p_key: flag("m"), p_mode: "on" })).data).toBe("ok");
    expect(mode(flag("m"))).toBe("on");
    expect(psql(`select count(*) from public.feature_flags where key = '${flag("m")}'`)).toBe("1");
  });

  it("AC-23: a mode that does not exist is refused and changes nothing", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    await service.rpc("admin_set_feature_flag", { p_key: flag("bad"), p_mode: "off" });
    expect((await service.rpc("admin_set_feature_flag", { p_key: flag("bad"), p_mode: "half" })).data).toBe("bad_mode");
    expect((await service.rpc("admin_set_feature_flag", { p_key: flag("bad"), p_mode: null as unknown as string })).data).toBe("bad_mode");
    expect(mode(flag("bad"))).toBe("off");
  });

  it("AC-23: a user is found by email in any case, added and removed idempotently, and then sees the flag as theirs", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    await service.rpc("admin_set_feature_flag", { p_key: flag("u"), p_mode: "allowlist" });
    const add = () => service.rpc("admin_set_feature_flag_user", { p_key: flag("u"), p_email: ana.email.toUpperCase(), p_allowed: true });
    expect((await add()).data).toBe("ok");
    expect((await add()).data).toBe("ok");
    expect(listed(flag("u"))).toBe("1");
    const seen = (await ana.client.rpc("feature_flags_for_me")).data?.find((r) => r.key === flag("u"));
    expect(seen).toEqual({ key: flag("u"), mode: "allowlist", listed: true });

    const remove = () => service.rpc("admin_set_feature_flag_user", { p_key: flag("u"), p_email: ana.email, p_allowed: false });
    expect((await remove()).data).toBe("ok");
    expect((await remove()).data).toBe("ok");
    expect(listed(flag("u"))).toBe("0");
  });

  it("AC-23: an email with no account, or a flag with no row, is told apart and changes nothing", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    await service.rpc("admin_set_feature_flag", { p_key: flag("n"), p_mode: "allowlist" });
    expect((await service.rpc("admin_set_feature_flag_user", { p_key: flag("n"), p_email: "nobody@kektura.test", p_allowed: true })).data).toBe("no_account");
    expect((await service.rpc("admin_set_feature_flag_user", { p_key: flag("norow"), p_email: ana.email, p_allowed: true })).data).toBe("no_flag");
    expect(psql(`select count(*) from public.feature_flag_users where key in ('${flag("n")}', '${flag("norow")}')`)).toBe("0");
    expect(mode(flag("norow"))).toBe("");
  });

  it("AC-17, AC-23: the list holds every stored flag with its mode and the size of its allowlist", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    await service.rpc("admin_set_feature_flag", { p_key: flag("l"), p_mode: "allowlist" });
    await service.rpc("admin_set_feature_flag_user", { p_key: flag("l"), p_email: ana.email, p_allowed: true });
    const { data } = await service.rpc("admin_list_feature_flags");
    expect(data?.find((row) => row.key === flag("l"))).toEqual({ key: flag("l"), mode: "allowlist", users: 1 });
    expect(data?.map((row) => row.key)).toContain("friends");
  });
});

describe("spec 0035: the allowlist functions of the flag panel", () => {
  it("AC-33: a flag's allowlist is listed by display name, never email, and a user is removed by id, once", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    await service.rpc("admin_set_feature_flag", { p_key: flag("p"), p_mode: "allowlist" });
    await service.rpc("admin_set_feature_flag_user", { p_key: flag("p"), p_email: ana.email, p_allowed: true });
    const { data } = await service.rpc("admin_list_feature_flag_users", { p_key: flag("p") });
    const name = psql(`select display_name from public.profiles where id = '${ana.id}'`);
    expect(data).toEqual([{ user_id: ana.id, display_name: name }]);
    expect(JSON.stringify(data)).not.toContain(ana.email);
    expect((await service.rpc("admin_list_feature_flag_users", { p_key: flag("nobody") })).data).toEqual([]);

    expect((await service.rpc("admin_remove_feature_flag_user", { p_key: flag("p"), p_user_id: ana.id })).data).toBe("ok");
    expect(listed(flag("p"))).toBe("0");
    expect((await service.rpc("admin_remove_feature_flag_user", { p_key: flag("p"), p_user_id: ana.id })).data).toBe("not_listed");
    expect((await service.rpc("admin_remove_feature_flag_user", { p_key: flag("nobody"), p_user_id: ana.id })).data).toBe("not_listed");
  });
});

describe("spec 0035: the Telegram webhook against the database", () => {
  let post: (text: string) => Promise<Response>;
  let POST: (request: Request) => Promise<Response>;

  beforeAll(async () => {
    if (!local) return;
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", local.url);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", local.serviceKey);
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:token");
    vi.stubEnv("TELEGRAM_CHAT_ID", "42");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "hook-secret");
    ({ POST } = await import("../src/app/api/telegram/route"));
    let id = 1;
    post = (text) =>
      POST(
        new Request("http://localhost/api/telegram", {
          method: "POST",
          headers: { "x-telegram-bot-api-secret-token": "hook-secret" },
          body: JSON.stringify({ update_id: id++, message: { text, chat: { id: 42 }, from: { id: 42 } } }),
        }),
      );
  });

  const reply = async (text: string) => {
    sent.length = 0;
    expect((await post(text)).status).toBe(200);
    return sent.join("\n");
  };

  it("AC-17, AC-19, AC-22: /flags, /allow and /deny reach the real functions, and the answers follow what the database did", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    expect(await reply("/flags")).toMatch(/^friends: on\n/);
    // friends is on for everybody, so listing a user changes nothing visible; the allowlist row is the proof.
    expect(await reply(`/allow friends ${ana.email}`)).toMatch(/added to the allowlist of friends\. The flag is on, so this has no effect/);
    expect(psql(`select count(*) from public.feature_flag_users where key = 'friends' and user_id = '${ana.id}'`)).toBe("1");
    expect(await reply(`/deny friends ${ana.email}`)).toMatch(/removed from the allowlist of friends\./);
    expect(psql(`select count(*) from public.feature_flag_users where key = 'friends' and user_id = '${ana.id}'`)).toBe("0");
    expect(await reply("/allow friends nobody@kektura.test")).toMatch(/No account has the email/);
  });

  it("AC-20, AC-22: /flag friends on asks, and /confirm sets the stored mode (here it already is on, so nothing else changes)", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    expect(await reply("/flag friends on")).toMatch(/Send \/confirm/);
    expect(await reply("/confirm")).toBe("friends is now on.");
    expect(psql("select mode from public.feature_flags where key = 'friends'")).toBe("on");
  });

  let tapId = 1000;
  const tap = async (data: string) => {
    edited.length = 0;
    answered.length = 0;
    const response = await POST(
      new Request("http://localhost/api/telegram", {
        method: "POST",
        headers: { "x-telegram-bot-api-secret-token": "hook-secret" },
        body: JSON.stringify({ update_id: tapId++, callback_query: { id: `cb-${tapId}`, data, from: { id: 42 }, message: { message_id: 7, chat: { id: 42 } } } }),
      }),
    );
    expect(response.status).toBe(200);
  };

  it("AC-28, AC-29, AC-30: the panel's buttons reach the real functions: the allowlist is opened by name, a user removed, a mode tapped", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const name = psql(`select display_name from public.profiles where id = '${ana.id}'`);
    expect(await reply(`/allow friends ${ana.email}`)).toMatch(/added to the allowlist/);

    await tap("f:friends");
    expect(edited[0].callbacks).toEqual(expect.arrayContaining(["m:friends:off:on", "m:friends:allowlist:on", "m:friends:on:on", "u:friends", "p"]));

    await tap("u:friends");
    expect(edited).toHaveLength(1);
    expect(edited[0].messageId).toBe(7);
    expect(edited[0].text).toContain("on the allowlist.");
    expect(edited[0].callbacks).toContain(`d:friends:${ana.id}`);
    expect(JSON.stringify(edited)).not.toContain(ana.email);
    expect(name).not.toBe("");

    await tap(`d:friends:${ana.id}`);
    expect(edited[0].text).toMatch(/^Removed./);
    expect(answered[0].text).toBe("Removed.");
    expect(psql(`select count(*) from public.feature_flag_users where key = 'friends' and user_id = '${ana.id}'`)).toBe("0");

    await tap(`d:friends:${ana.id}`);
    expect(answered[0].text).toBe("That user was not on the list any more.");

    // friends is on: tapping the mode it has is only a notice, and a panel that claims another mode is refreshed.
    await tap("m:friends:on:on");
    expect(answered[0].text).toBe("friends is already on");
    await tap("m:friends:off:off");
    expect(answered[0].text).toBe("Changed since: nothing applied");
    expect(psql("select mode from public.feature_flags where key = 'friends'")).toBe("on");
  });
});
