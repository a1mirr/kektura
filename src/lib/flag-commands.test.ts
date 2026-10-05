import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIRM_WINDOW_MS, MAX_CALLBACK_BYTES, MAX_LISTED_USERS, callbackData, createFlagBot, type FlagAdminStore, type ListedUser } from "./flag-commands";
import { FLAG_KEYS } from "./feature-flags";

const ANA = "3f0c1b6e-9d41-4c55-8a39-2b7a5c1e9d02";
const BOB = "7a1d2c3e-1111-4222-8333-444455556666";

// A store that remembers what it was asked to do, in order.
function fakeStore(rows: { key: string; mode: string; users: number }[] = [], users: Record<string, ListedUser[]> = {}) {
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
    listUsers: vi.fn(async (key) => users[key] ?? []),
    removeUser: vi.fn(async (key, userId) => {
      calls.push(`remove ${key} ${userId}`);
      const list = users[key] ?? [];
      const at = list.findIndex((u) => u.id === userId);
      if (at < 0) return "not_listed";
      list.splice(at, 1);
      const row = rows.find((r) => r.key === key);
      if (row) row.users -= 1;
      return "ok";
    }),
  };
  return { store, calls, rows, users };
}

let clock = 1_000_000;
const now = () => clock;
beforeEach(() => {
  clock = 1_000_000;
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const text = async (bot: ReturnType<typeof createFlagBot>, message: string) => (await bot.handle(message)).text;

describe("spec 0035: flag commands of the Telegram bot", () => {
  it("AC-17: /flags lists every declared flag with its description and mode, and an allowlist's size", async () => {
    const { store } = fakeStore([{ key: "friends", mode: "allowlist", users: 2 }]);
    const reply = await text(createFlagBot({ store, now }), "/flags");
    for (const key of FLAG_KEYS) expect(reply).toContain(key);
    expect(reply).toContain("friends: allowlist, 2 users");
    expect(reply).toContain("Friends: share progress");
  });

  it("AC-17: a flag with no row shows its default, and a stored flag that is not declared is not listed", async () => {
    const { store } = fakeStore([{ key: "retired", mode: "on", users: 0 }]);
    const reply = await text(createFlagBot({ store, now }), "/flags");
    expect(reply).toContain("friends: off (default)");
    expect(reply).not.toContain("retired");
  });

  it("AC-18: /flag sets off and allowlist at once and answers with the new state", async () => {
    const { store, calls } = fakeStore();
    const bot = createFlagBot({ store, now });
    expect(await text(bot, "/flag friends allowlist")).toBe("friends is now allowlist.");
    expect(await text(bot, "/FLAG friends off")).toBe("friends is now off.");
    expect(calls).toEqual(["mode friends allowlist", "mode friends off"]);
  });

  it("AC-18: an undeclared key or a mode that does not exist is refused with the valid ones, and nothing changes", async () => {
    const { store, calls } = fakeStore();
    const bot = createFlagBot({ store, now });
    expect(await text(bot, "/flag nope on")).toMatch(/Unknown flag.*friends/);
    expect(await text(bot, "/flag friends sometimes")).toMatch(/Unknown mode.*off, allowlist, on/);
    expect(await text(bot, "/flag friends")).toMatch(/Unknown mode/);
    expect(await text(bot, "/flag")).toMatch(/Unknown flag/);
    expect(calls).toEqual([]);
  });

  it("AC-19: /allow and /deny add and remove one user by email, and say when the account does not exist", async () => {
    const { store, calls } = fakeStore([{ key: "friends", mode: "allowlist", users: 1 }]);
    const bot = createFlagBot({ store, now });
    expect(await text(bot, "/allow friends ana@example.com")).toBe("ana@example.com added to the allowlist of friends.");
    expect(await text(bot, "/deny friends ana@example.com")).toBe("ana@example.com removed from the allowlist of friends.");
    expect(await text(bot, "/allow friends nobody@example.com")).toMatch(/No account has the email nobody@example.com/);
    expect(calls).toEqual(["user friends ana@example.com true", "user friends ana@example.com false", "user friends nobody@example.com true"]);
  });

  it("AC-19: a user added to a flag that is not on an allowlist is stored, and the answer says it has no effect yet", async () => {
    const { store } = fakeStore([{ key: "friends", mode: "off", users: 0 }]);
    expect(await text(createFlagBot({ store, now }), "/allow friends ana@example.com")).toMatch(/The flag is off, so this has no effect/);
  });

  it("AC-19, AC-22: when the change is done but the mode cannot be read back, it is still reported as done, once in the log", async () => {
    const { store } = fakeStore([{ key: "friends", mode: "allowlist", users: 0 }]);
    store.list = vi.fn(async () => {
      throw new Error("down");
    });
    expect(await text(createFlagBot({ store, now }), "/allow friends ana@example.com")).toBe("ana@example.com added to the allowlist of friends.");
    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("AC-19: a flag with no row first gets its default mode, then the user", async () => {
    const { store, calls } = fakeStore();
    const reply = await text(createFlagBot({ store, now }), "/allow friends ana@example.com");
    expect(calls).toEqual(["user friends ana@example.com true", "mode friends off", "user friends ana@example.com true"]);
    expect(reply).toMatch(/added to the allowlist of friends/);
  });

  it("AC-19: a bad email or flag is refused before the database is asked", async () => {
    const { store, calls } = fakeStore();
    const bot = createFlagBot({ store, now });
    expect(await text(bot, "/allow friends not-an-email")).toMatch(/Usage: \/allow friends <email>/);
    expect(await text(bot, "/deny friends")).toMatch(/Usage: \/deny/);
    expect(await text(bot, "/allow nope ana@example.com")).toMatch(/Unknown flag/);
    expect(calls).toEqual([]);
  });

  it("AC-20: switching a flag on asks to confirm, and /confirm within 60 seconds does it", async () => {
    const { store, calls } = fakeStore();
    const bot = createFlagBot({ store, now });
    expect(await text(bot, "/flag friends on")).toMatch(/everybody, signed-out visitors included.*\/confirm within 60 seconds/);
    expect(calls).toEqual([]);
    clock += CONFIRM_WINDOW_MS - 1;
    expect(await text(bot, "/confirm")).toBe("friends is now on.");
    expect(calls).toEqual(["mode friends on"]);
    expect(await text(bot, "/confirm")).toBe("Nothing to confirm.");
  });

  it("AC-20: a late /confirm, anything else in between, or a second /confirm changes nothing", async () => {
    const { store, calls } = fakeStore();
    const bot = createFlagBot({ store, now });
    await bot.handle("/flag friends on");
    clock += CONFIRM_WINDOW_MS + 1;
    expect(await text(bot, "/confirm")).toBe("Nothing to confirm.");
    await bot.handle("/flag friends on");
    await bot.handle("/flags"); // anything else cancels
    expect(await text(bot, "/confirm")).toBe("Nothing to confirm.");
    await bot.handle("/flag friends on");
    await bot.handle("/flag friends off"); // and is carried out as its own command
    expect(await text(bot, "/confirm")).toBe("Nothing to confirm.");
    expect(calls).toEqual(["mode friends off"]);
  });

  it("AC-20: turning a flag off never asks", async () => {
    const { store } = fakeStore([{ key: "friends", mode: "on", users: 0 }]);
    expect(await text(createFlagBot({ store, now }), "/flag friends off")).toBe("friends is now off.");
  });

  it("AC-21: anything else gets the help text with every command and a word about the panel", async () => {
    const { store, calls } = fakeStore();
    const bot = createFlagBot({ store, now });
    for (const message of ["hello", "", "/start", "/flagsx", "/deploy now"]) {
      const reply = await text(bot, message);
      for (const command of ["/flags", "/flag <key>", "/allow", "/deny", "buttons"]) expect(reply, message).toContain(command);
    }
    expect(calls).toEqual([]);
  });

  it("AC-21: the bot's own name after a command, as Telegram adds it in a group, is ignored", async () => {
    const { store } = fakeStore();
    expect(await text(createFlagBot({ store, now }), "/flag@kektura_bot friends off")).toBe("friends is now off.");
  });

  it("AC-22: the answer comes after the database accepted the change, and a refusal says failed", async () => {
    const order: string[] = [];
    const { store } = fakeStore();
    store.setMode = vi.fn(async () => {
      await Promise.resolve();
      order.push("database");
    });
    const reply = await text(createFlagBot({ store, now }), "/flag friends off");
    order.push("answer");
    expect(reply).toBe("friends is now off.");
    expect(order).toEqual(["database", "answer"]);

    store.setMode = vi.fn(async () => {
      throw { code: "42501", message: "denied" };
    });
    expect(await text(createFlagBot({ store, now }), "/flag friends off")).toMatch(/^Failed: nothing was changed/);
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
    expect(await text(bot, "/flags")).toMatch(/^Failed/);
    expect(await text(bot, "/allow friends ana@example.com")).toMatch(/^Failed/);
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

// The buttons of the panel the owner gets from /flags (spec 0035 AC-27 to AC-32).
describe("spec 0035: the flag panel and its buttons", () => {
  const buttons = (reply: { keyboard?: { text: string; callback_data: string }[][] }) => (reply.keyboard ?? []).flat();

  it("AC-27: /flags comes with a row of off, allowlist and on for every flag, the current mode marked", async () => {
    const { store } = fakeStore([{ key: "friends", mode: "on", users: 0 }]);
    const reply = await createFlagBot({ store, now }).handle("/flags");
    expect(reply.keyboard).toEqual([
      [
        { text: "off", callback_data: "m:friends:off:on" },
        { text: "allowlist", callback_data: "m:friends:allowlist:on" },
        { text: "● on", callback_data: "m:friends:on:on" },
      ],
    ]);
  });

  it("AC-27: a flag on an allowlist, or with users, gets a button that opens the list", async () => {
    const { store } = fakeStore([{ key: "friends", mode: "allowlist", users: 2 }]);
    expect(buttons(await createFlagBot({ store, now }).handle("/flags"))).toContainEqual({ text: "friends: 2 users", callback_data: "u:friends" });
    const { store: other } = fakeStore([{ key: "friends", mode: "on", users: 1 }]);
    expect(buttons(await createFlagBot({ store: other, now }).handle("/flags"))).toContainEqual({ text: "friends: 1 user", callback_data: "u:friends" });
    const { store: none } = fakeStore([{ key: "friends", mode: "off", users: 0 }]);
    expect(buttons(await createFlagBot({ store: none, now }).handle("/flags")).map((b) => b.callback_data)).not.toContain("u:friends");
  });

  it("AC-28: tapping off or allowlist applies it and shows the panel with the new state", async () => {
    const { store, calls } = fakeStore([{ key: "friends", mode: "on", users: 0 }]);
    const bot = createFlagBot({ store, now });
    const { reply, notice } = await bot.press("m:friends:off:on");
    expect(calls).toEqual(["mode friends off"]);
    expect(notice).toBe("friends is now off.");
    expect(reply?.text).toMatch(/^friends is now off\.\n\nfriends: off\n/);
    expect(buttons(reply!)).toContainEqual({ text: "● off", callback_data: "m:friends:off:off" });
    await bot.press("m:friends:allowlist:off");
    expect(calls).toEqual(["mode friends off", "mode friends allowlist"]);
  });

  it("AC-28: tapping on only asks, and the typed /confirm within 60 seconds does it", async () => {
    const { store, calls } = fakeStore([{ key: "friends", mode: "off", users: 0 }]);
    const bot = createFlagBot({ store, now });
    const { reply, notice } = await bot.press("m:friends:on:off");
    expect(calls).toEqual([]);
    expect(reply?.text).toMatch(/everybody, signed-out visitors included.*\/confirm within 60 seconds/);
    expect(notice).toBe("Send /confirm");
    expect(buttons(reply!)).toEqual([{ text: "‹ Back", callback_data: "p" }]);
    expect(await text(bot, "/confirm")).toBe("friends is now on.");
    expect(calls).toEqual(["mode friends on"]);
  });

  it("AC-28: a tap on a panel that is out of date changes nothing and shows the panel as it is", async () => {
    const { store, calls } = fakeStore([{ key: "friends", mode: "allowlist", users: 0 }]);
    const { reply, notice } = await createFlagBot({ store, now }).press("m:friends:off:on"); // shown while it was on
    expect(calls).toEqual([]);
    expect(notice).toBe("Changed since: nothing applied");
    expect(reply?.text).toMatch(/^friends is allowlist now, not on: nothing was changed\./);
    expect(buttons(reply!)).toContainEqual({ text: "● allowlist", callback_data: "m:friends:allowlist:allowlist" });
  });

  it("AC-28: tapping the mode it already has is only a notice", async () => {
    const { store, calls } = fakeStore([{ key: "friends", mode: "on", users: 0 }]);
    expect(await createFlagBot({ store, now }).press("m:friends:on:on")).toEqual({ notice: "friends is already on" });
    expect(calls).toEqual([]);
  });

  it("AC-28: a tap cancels a pending /confirm like any other message", async () => {
    const { store, calls } = fakeStore([{ key: "friends", mode: "off", users: 0 }]);
    const bot = createFlagBot({ store, now });
    await bot.handle("/flag friends on");
    await bot.press("p");
    expect(await text(bot, "/confirm")).toBe("Nothing to confirm.");
    expect(calls).toEqual([]);
  });

  it("AC-29: the allowlist button lists the users by name with a Remove button each, and Back", async () => {
    const { store } = fakeStore([{ key: "friends", mode: "allowlist", users: 2 }], { friends: [{ id: ANA, name: "Ana" }, { id: BOB, name: "Bob" }] });
    const { reply } = await createFlagBot({ store, now }).press("u:friends");
    expect(reply?.text).toContain("friends: 2 users on the allowlist.");
    expect(reply?.text).toContain("/allow friends <email>");
    expect(buttons(reply!)).toEqual([
      { text: "Remove Ana", callback_data: `d:friends:${ANA}` },
      { text: "Remove Bob", callback_data: `d:friends:${BOB}` },
      { text: "‹ Back", callback_data: "p" },
    ]);
  });

  it("AC-29: at most 20 users are named, the rest is a count, and long names are cut", async () => {
    const many = Array.from({ length: 23 }, (_, i) => ({ id: `3f0c1b6e-9d41-4c55-8a39-2b7a5c1e9d${String(i).padStart(2, "0")}`, name: i === 0 ? "W".repeat(40) : `User ${i}` }));
    const { store } = fakeStore([{ key: "friends", mode: "allowlist", users: 23 }], { friends: many });
    const { reply } = await createFlagBot({ store, now }).press("u:friends");
    expect(buttons(reply!)).toHaveLength(MAX_LISTED_USERS + 1);
    expect(reply?.text).toContain("and 3 more");
    expect(buttons(reply!)[0].text).toBe(`Remove ${"W".repeat(27)}…`);
  });

  it("AC-29: Remove takes the user off and shows the refreshed list; someone already gone is only the refreshed list", async () => {
    const { store, calls } = fakeStore([{ key: "friends", mode: "allowlist", users: 2 }], { friends: [{ id: ANA, name: "Ana" }, { id: BOB, name: "Bob" }] });
    const bot = createFlagBot({ store, now });
    const first = await bot.press(`d:friends:${ANA}`);
    expect(first.reply?.text).toMatch(/^Removed\.\n\nfriends: 1 user on the allowlist\./);
    expect(buttons(first.reply!).map((b) => b.text)).toEqual(["Remove Bob", "‹ Back"]);
    const again = await bot.press(`d:friends:${ANA}`);
    expect(again.notice).toBe("That user was not on the list any more.");
    expect(calls).toEqual([`remove friends ${ANA}`, `remove friends ${ANA}`]);
  });

  it("AC-29: Back shows the panel", async () => {
    const { store } = fakeStore([{ key: "friends", mode: "on", users: 0 }]);
    expect((await createFlagBot({ store, now }).press("p")).reply?.text).toContain("friends: on");
  });

  it("AC-30: data that is not one of ours is ignored: another flag, a bad mode or id, extra parts, nothing", async () => {
    const { store, calls } = fakeStore([{ key: "friends", mode: "on", users: 0 }]);
    const bot = createFlagBot({ store, now });
    for (const data of ["", "x", "m:nope:off:on", "m:friends:half:on", "m:friends:off", "m:friends:off:on:extra", "u:nope", "u:friends:x", "d:friends:not-a-uuid", `d:friends:${ANA}:x`, "p:friends", "d:friends"]) {
      expect(await bot.press(data), data).toEqual({});
    }
    expect(calls).toEqual([]);
  });

  it("AC-30: a tap never throws, and a failed change says so and is logged", async () => {
    const { store } = fakeStore([{ key: "friends", mode: "on", users: 0 }], { friends: [{ id: ANA, name: "Ana" }] });
    store.setMode = vi.fn(async () => {
      throw { code: "42501", message: "denied" };
    });
    const failed = await createFlagBot({ store, now }).press("m:friends:off:on");
    expect(failed.notice).toMatch(/^Failed/);
    store.removeUser = vi.fn(async () => {
      throw { code: "42501", message: "denied" };
    });
    expect((await createFlagBot({ store, now }).press(`d:friends:${ANA}`)).notice).toBe("Failed");
    store.list = vi.fn(async () => {
      throw new Error("down");
    });
    expect(await createFlagBot({ store, now }).press("p")).toEqual({ notice: "Failed" });
  });

  it("AC-31: every button's data is at most 64 bytes, for the longest user id, the longest mode and every declared flag", () => {
    for (const key of FLAG_KEYS) {
      for (const data of [callbackData.mode(key, "allowlist", "allowlist"), callbackData.users(key), callbackData.remove(key, ANA), callbackData.panel]) {
        expect(new TextEncoder().encode(data).length, `${key}: ${data}`).toBeLessThanOrEqual(MAX_CALLBACK_BYTES);
      }
    }
  });

  it("AC-32: a change from a button is logged like a typed one, never with a name or an id", async () => {
    const { store } = fakeStore([{ key: "friends", mode: "on", users: 1 }], { friends: [{ id: ANA, name: "Ana Secret" }] });
    const bot = createFlagBot({ store, now });
    await bot.press("m:friends:off:on");
    await bot.press(`d:friends:${ANA}`);
    const lines = vi.mocked(console.info).mock.calls.map((c) => c[0] as string);
    expect(lines).toEqual(["[feature-flags] change key=friends change=off result=ok", "[feature-flags] change key=friends change=deny result=ok"]);
    expect(lines.join("\n")).not.toMatch(/Ana|3f0c1b6e/);
  });
});
