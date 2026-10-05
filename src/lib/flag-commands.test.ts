import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIRM_WINDOW_MS, createFlagBot, type FlagAdminStore } from "./flag-commands";
import { FLAG_KEYS } from "./feature-flags";

// A store that remembers what it was asked to do, in order.
function fakeStore(rows: { key: string; mode: string; users: number }[] = []) {
  const calls: string[] = [];
  const store: FlagAdminStore = {
    list: vi.fn(async () => rows),
    setMode: vi.fn(async (key, mode) => {
      calls.push(`mode ${key} ${mode}`);
      const row = rows.find((r) => r.key === key);
      if (row) row.mode = mode;
      else rows.push({ key, mode, users: 0 });
    }),
    setUser: vi.fn(async (key, email, allowed) => {
      calls.push(`user ${key} ${email} ${allowed}`);
      return email.startsWith("nobody") ? "no_account" : rows.some((r) => r.key === key) ? "ok" : "no_flag";
    }),
  };
  return { store, calls, rows };
}

let clock = 1_000_000;
const now = () => clock;
beforeEach(() => {
  clock = 1_000_000;
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("spec 0035: flag commands of the Telegram bot", () => {
  it("AC-17: /flags lists every declared flag with its description and mode, and an allowlist's size", async () => {
    const { store } = fakeStore([{ key: "friends", mode: "allowlist", users: 2 }]);
    const reply = await createFlagBot({ store, now }).handle("/flags");
    for (const key of FLAG_KEYS) expect(reply).toContain(key);
    expect(reply).toContain("friends: allowlist, 2 users");
    expect(reply).toContain("Friends: share progress");
  });

  it("AC-17: a flag with no row shows its default, and a stored flag that is not declared is not listed", async () => {
    const { store } = fakeStore([{ key: "retired", mode: "on", users: 0 }]);
    const reply = await createFlagBot({ store, now }).handle("/flags");
    expect(reply).toContain("friends: off (default)");
    expect(reply).not.toContain("retired");
  });

  it("AC-18: /flag sets off and allowlist at once and answers with the new state", async () => {
    const { store, calls } = fakeStore();
    const bot = createFlagBot({ store, now });
    expect(await bot.handle("/flag friends allowlist")).toBe("friends is now allowlist.");
    expect(await bot.handle("/FLAG friends off")).toBe("friends is now off.");
    expect(calls).toEqual(["mode friends allowlist", "mode friends off"]);
  });

  it("AC-18: an undeclared key or a mode that does not exist is refused with the valid ones, and nothing changes", async () => {
    const { store, calls } = fakeStore();
    const bot = createFlagBot({ store, now });
    expect(await bot.handle("/flag nope on")).toMatch(/Unknown flag.*friends/);
    expect(await bot.handle("/flag friends sometimes")).toMatch(/Unknown mode.*off, allowlist, on/);
    expect(await bot.handle("/flag friends")).toMatch(/Unknown mode/);
    expect(await bot.handle("/flag")).toMatch(/Unknown flag/);
    expect(calls).toEqual([]);
  });

  it("AC-19: /allow and /deny add and remove one user by email, and say when the account does not exist", async () => {
    const { store, calls } = fakeStore([{ key: "friends", mode: "allowlist", users: 1 }]);
    const bot = createFlagBot({ store, now });
    expect(await bot.handle("/allow friends ana@example.com")).toBe("ana@example.com added to the allowlist of friends.");
    expect(await bot.handle("/deny friends ana@example.com")).toBe("ana@example.com removed from the allowlist of friends.");
    expect(await bot.handle("/allow friends nobody@example.com")).toMatch(/No account has the email nobody@example.com/);
    expect(calls).toEqual(["user friends ana@example.com true", "user friends ana@example.com false", "user friends nobody@example.com true"]);
  });

  it("AC-19: a user added to a flag that is not on an allowlist is stored, and the answer says it has no effect yet", async () => {
    const { store } = fakeStore([{ key: "friends", mode: "off", users: 0 }]);
    expect(await createFlagBot({ store, now }).handle("/allow friends ana@example.com")).toMatch(/The flag is off, so this has no effect/);
  });

  it("AC-19, AC-22: when the change is done but the mode cannot be read back, it is still reported as done, once in the log", async () => {
    const { store } = fakeStore([{ key: "friends", mode: "allowlist", users: 0 }]);
    store.list = vi.fn(async () => {
      throw new Error("down");
    });
    expect(await createFlagBot({ store, now }).handle("/allow friends ana@example.com")).toBe("ana@example.com added to the allowlist of friends.");
    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("AC-19: a flag with no row first gets its default mode, then the user", async () => {
    const { store, calls } = fakeStore();
    const reply = await createFlagBot({ store, now }).handle("/allow friends ana@example.com");
    expect(calls).toEqual(["user friends ana@example.com true", "mode friends off", "user friends ana@example.com true"]);
    expect(reply).toMatch(/added to the allowlist of friends/);
  });

  it("AC-19: a bad email or flag is refused before the database is asked", async () => {
    const { store, calls } = fakeStore();
    const bot = createFlagBot({ store, now });
    expect(await bot.handle("/allow friends not-an-email")).toMatch(/Usage: \/allow friends <email>/);
    expect(await bot.handle("/deny friends")).toMatch(/Usage: \/deny/);
    expect(await bot.handle("/allow nope ana@example.com")).toMatch(/Unknown flag/);
    expect(calls).toEqual([]);
  });

  it("AC-20: switching a flag on asks to confirm, and /confirm within 60 seconds does it", async () => {
    const { store, calls } = fakeStore();
    const bot = createFlagBot({ store, now });
    expect(await bot.handle("/flag friends on")).toMatch(/everybody, signed-out visitors included.*\/confirm within 60 seconds/);
    expect(calls).toEqual([]);
    clock += CONFIRM_WINDOW_MS - 1;
    expect(await bot.handle("/confirm")).toBe("friends is now on.");
    expect(calls).toEqual(["mode friends on"]);
    expect(await bot.handle("/confirm")).toBe("Nothing to confirm.");
  });

  it("AC-20: a late /confirm, anything else in between, or a second /confirm changes nothing", async () => {
    const { store, calls } = fakeStore();
    const bot = createFlagBot({ store, now });
    await bot.handle("/flag friends on");
    clock += CONFIRM_WINDOW_MS + 1;
    expect(await bot.handle("/confirm")).toBe("Nothing to confirm.");
    await bot.handle("/flag friends on");
    await bot.handle("/flags"); // anything else cancels
    expect(await bot.handle("/confirm")).toBe("Nothing to confirm.");
    await bot.handle("/flag friends on");
    await bot.handle("/flag friends off"); // and is carried out as its own command
    expect(await bot.handle("/confirm")).toBe("Nothing to confirm.");
    expect(calls).toEqual(["mode friends off"]);
  });

  it("AC-20: turning a flag off never asks", async () => {
    const { store } = fakeStore([{ key: "friends", mode: "on", users: 0 }]);
    expect(await createFlagBot({ store, now }).handle("/flag friends off")).toBe("friends is now off.");
  });

  it("AC-21: anything else gets the help text with every command", async () => {
    const { store, calls } = fakeStore();
    const bot = createFlagBot({ store, now });
    for (const text of ["hello", "", "/start", "/flagsx", "/deploy now"]) {
      const reply = await bot.handle(text);
      for (const command of ["/flags", "/flag <key>", "/allow", "/deny"]) expect(reply, text).toContain(command);
    }
    expect(calls).toEqual([]);
  });

  it("AC-21: the bot's own name after a command, as Telegram adds it in a group, is ignored", async () => {
    const { store } = fakeStore();
    expect(await createFlagBot({ store, now }).handle("/flag@kektura_bot friends off")).toBe("friends is now off.");
  });

  it("AC-22: the answer comes after the database accepted the change, and a refusal says failed", async () => {
    const order: string[] = [];
    const { store } = fakeStore();
    store.setMode = vi.fn(async () => {
      await Promise.resolve();
      order.push("database");
    });
    const reply = await createFlagBot({ store, now }).handle("/flag friends off");
    order.push("answer");
    expect(reply).toBe("friends is now off.");
    expect(order).toEqual(["database", "answer"]);

    store.setMode = vi.fn(async () => {
      throw { code: "42501", message: "denied" };
    });
    expect(await createFlagBot({ store, now }).handle("/flag friends off")).toMatch(/^Failed: nothing was changed/);
  });

  it("AC-22: the commands never throw, whatever the store does", async () => {
    const { store } = fakeStore();
    store.list = vi.fn(async () => {
      throw new Error("down");
    });
    store.setUser = vi.fn(async () => {
      throw new Error("down");
    });
    const bot = createFlagBot({ store, now });
    expect(await bot.handle("/flags")).toMatch(/^Failed/);
    expect(await bot.handle("/allow friends ana@example.com")).toMatch(/^Failed/);
  });

  it("AC-24: each change is logged as one line with the flag, the change and the result, never the email", async () => {
    const { store } = fakeStore([{ key: "friends", mode: "allowlist", users: 0 }]);
    const bot = createFlagBot({ store, now });
    await bot.handle("/flag friends off");
    await bot.handle("/allow friends ana@example.com");
    await bot.handle("/allow friends nobody@example.com");
    store.setMode = vi.fn(async () => {
      throw { code: "42501", message: "denied" };
    });
    await bot.handle("/flag friends allowlist");
    const lines = [...vi.mocked(console.info).mock.calls, ...vi.mocked(console.error).mock.calls].map((c) => c[0] as string);
    expect(lines).toEqual([
      "[feature-flags] change key=friends change=off result=ok",
      "[feature-flags] change key=friends change=allow result=ok",
      "[feature-flags] change key=friends change=allow result=no_account",
      '[feature-flags] change key=friends change=allowlist result=failed code=42501 message="denied"',
    ]);
    expect(lines.join("\n")).not.toContain("example.com");
  });
});
