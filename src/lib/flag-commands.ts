import { FLAG_KEYS, FLAG_MODES, FLAGS, isFlagKey, isFlagMode, type FlagKey, type FlagMode } from "./feature-flags";
import { logFeatureFlagsError, logFlagChange } from "./log";
import type { InlineKeyboard } from "./telegram";

// What the owner sends the Telegram bot to look at and switch feature flags, as typed commands and as taps on the
// panel's buttons (spec 0035 AC-17 to AC-22 and AC-27 to AC-32). Pure apart from the store it is given and the clock, so
// every reply is unit-tested. The texts are English: this is the owner's own tool, not part of the three-language rule.

export const CONFIRM_WINDOW_MS = 60_000;
// How many users of an allowlist the panel names; the rest is "and N more".
export const MAX_LISTED_USERS = 20;
// Telegram refuses callback data over 64 bytes (AC-31).
export const MAX_CALLBACK_BYTES = 64;

export type StoredFlagSummary = { key: string; mode: string; users: number };
export type ListedUser = { id: string; name: string };

// What the bot needs from the database (spec 0035 AC-23). Every method throws when the database refuses.
export type FlagAdminStore = {
  list(): Promise<StoredFlagSummary[]>;
  setMode(key: FlagKey, mode: FlagMode): Promise<void>;
  setUser(key: FlagKey, email: string, allowed: boolean): Promise<"ok" | "no_account" | "no_flag">;
  listUsers(key: FlagKey): Promise<ListedUser[]>;
  removeUser(key: FlagKey, userId: string): Promise<"ok" | "not_listed">;
};

// What the bot says: a text and, under it, buttons.
export type BotReply = { text: string; keyboard?: InlineKeyboard };
// The answer to a tap: the message is replaced by `reply` (or left alone), `notice` is the short toast Telegram shows.
export type PressResult = { reply?: BotReply; notice?: string };

const HELP = [
  "Flag commands (/flags shows a panel with buttons for the same):",
  "/flags - every flag with its mode",
  "/flag <key> <off|allowlist|on> - set a mode (on asks for /confirm)",
  "/allow <key> <email> - add a user to a flag's allowlist",
  "/deny <key> <email> - remove a user from it",
].join("\n");

const FAILED = "Failed: nothing was changed. The reason is in the server log.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}$/;

// The data of the buttons (AC-31): `m:<key>:<mode>:<shown>` sets a mode, knowing the mode the panel showed; `u:<key>`
// opens an allowlist; `d:<key>:<user id>` removes one user from it; `p` shows the panel again.
export const callbackData = {
  mode: (key: FlagKey, mode: FlagMode, shown: FlagMode) => `m:${key}:${mode}:${shown}`,
  users: (key: FlagKey) => `u:${key}`,
  remove: (key: FlagKey, userId: string) => `d:${key}:${userId}`,
  panel: "p",
};

// "/flag@kektura_bot friends on" in a group chat: the bot's name is not part of the command.
function words(text: string): string[] {
  const [command = "", ...rest] = text.trim().split(/\s+/);
  return [command.toLowerCase().replace(/@\w+$/, ""), ...rest];
}

const plural = (count: number) => `${count} user${count === 1 ? "" : "s"}`;
const shorten = (name: string) => (name.length > 28 ? `${name.slice(0, 27)}…` : name);

export function createFlagBot({ store, now = Date.now }: { store: FlagAdminStore; now?: () => number }) {
  let pending: { key: FlagKey; expiresAt: number } | null = null;

  const modeOf = (rows: StoredFlagSummary[], key: FlagKey): FlagMode => {
    const row = rows.find((r) => r.key === key);
    return row && isFlagMode(row.mode) ? row.mode : FLAGS[key].default;
  };

  // Every declared flag with its description and mode, and under each its three mode buttons (the current one marked)
  // and, for an allowlist, a button that opens it (AC-17, AC-27).
  async function panel(note?: string): Promise<BotReply> {
    const rows = await store.list();
    const lines = FLAG_KEYS.map((key) => {
      const row = rows.find((r) => r.key === key);
      const mode = modeOf(rows, key);
      const users = mode === "allowlist" ? `, ${plural(row?.users ?? 0)}` : "";
      return `${key}: ${mode}${users}${row ? "" : " (default)"}\n  ${FLAGS[key].description}`;
    });
    const keyboard: InlineKeyboard = FLAG_KEYS.flatMap((key) => {
      const mode = modeOf(rows, key);
      const buttons = [
        FLAG_MODES.map((target) => ({ text: target === mode ? `● ${target}` : target, callback_data: callbackData.mode(key, target, mode) })),
      ];
      const users = rows.find((r) => r.key === key)?.users ?? 0;
      if (mode === "allowlist" || users > 0) buttons.push([{ text: `${key}: ${plural(users)}`, callback_data: callbackData.users(key) }]);
      return buttons;
    });
    return { text: [note, lines.join("\n")].filter(Boolean).join("\n\n"), keyboard };
  }

  // The users of one flag's allowlist, each with a Remove button (AC-29).
  async function usersPanel(key: FlagKey, note?: string): Promise<BotReply> {
    const users = await store.listUsers(key);
    const shown = users.slice(0, MAX_LISTED_USERS);
    const head = users.length === 0 ? `${key}: nobody on the allowlist.` : `${key}: ${plural(users.length)} on the allowlist.`;
    const more = users.length > shown.length ? `\nand ${users.length - shown.length} more` : "";
    const keyboard: InlineKeyboard = [
      ...shown.map((user) => [{ text: `Remove ${shorten(user.name)}`, callback_data: callbackData.remove(key, user.id) }]),
      [{ text: "‹ Back", callback_data: callbackData.panel }],
    ];
    return { text: [note, head + more, "Add one with /allow " + key + " <email>."].filter(Boolean).join("\n\n"), keyboard };
  }

  async function apply(key: FlagKey, mode: FlagMode): Promise<string> {
    try {
      await store.setMode(key, mode);
    } catch (error) {
      logFlagChange(key, mode, "failed", error);
      return FAILED;
    }
    logFlagChange(key, mode, "ok");
    return `${key} is now ${mode}.`;
  }

  // On is for everybody, signed-out visitors included: it takes a second message (AC-20), typed or tapped.
  function askToConfirm(key: FlagKey): string {
    pending = { key, expiresAt: now() + CONFIRM_WINDOW_MS };
    return `${key} would be on for everybody, signed-out visitors included. Send /confirm within ${CONFIRM_WINDOW_MS / 1000} seconds to do it; anything else cancels.`;
  }

  async function setMode(key: string | undefined, mode: string | undefined): Promise<string> {
    if (!key || !isFlagKey(key)) return `Unknown flag. Declared flags: ${FLAG_KEYS.join(", ")}.`;
    if (!mode || !isFlagMode(mode)) return `Unknown mode. Valid modes: ${FLAG_MODES.join(", ")}.`;
    return mode === "on" ? askToConfirm(key) : apply(key, mode);
  }

  async function allow(key: string | undefined, email: string | undefined, allowed: boolean): Promise<string> {
    if (!key || !isFlagKey(key)) return `Unknown flag. Declared flags: ${FLAG_KEYS.join(", ")}.`;
    if (!email || !EMAIL.test(email)) return `Usage: /${allowed ? "allow" : "deny"} ${key} <email>`;
    const change = allowed ? "allow" : "deny";
    try {
      let result = await store.setUser(key, email, allowed);
      if (result === "no_flag") {
        // The flag has no row yet: it starts from its default, then the user is listed.
        await store.setMode(key, FLAGS[key].default);
        result = await store.setUser(key, email, allowed);
      }
      if (result !== "ok") {
        logFlagChange(key, change, "no_account");
        return `No account has the email ${email}. Nothing was changed.`;
      }
      logFlagChange(key, change, "ok");
      // The change is done: failing to read the mode back only costs the note, never the answer.
      const mode = await store.list().then((rows) => modeOf(rows, key), () => null);
      const note = allowed && mode && mode !== "allowlist" ? ` The flag is ${mode}, so this has no effect until it is set to allowlist.` : "";
      return `${email} ${allowed ? "added to" : "removed from"} the allowlist of ${key}.${note}`;
    } catch (error) {
      logFlagChange(key, change, "failed", error);
      return FAILED;
    }
  }

  // A tap on a mode button (AC-28). The button knows the mode the panel showed: when the flag is in another mode now
  // (changed in the dashboard, or from another message) nothing is applied and the panel is shown as it is.
  async function pressMode(key: FlagKey, target: FlagMode, shown: FlagMode): Promise<PressResult> {
    const current = modeOf(await store.list(), key);
    if (current !== shown) return { reply: await panel(`${key} is ${current} now, not ${shown}: nothing was changed.`), notice: "Changed since: nothing applied" };
    if (target === current) return { notice: `${key} is already ${current}` };
    if (target === "on") {
      return { reply: { text: askToConfirm(key), keyboard: [[{ text: "‹ Back", callback_data: callbackData.panel }]] }, notice: "Send /confirm" };
    }
    const done = await apply(key, target);
    return { reply: await panel(done), notice: done };
  }

  // A tap on Remove (AC-29): whoever is no longer listed is only a refreshed list.
  async function pressRemove(key: FlagKey, userId: string): Promise<PressResult> {
    let result: "ok" | "not_listed";
    try {
      result = await store.removeUser(key, userId);
    } catch (error) {
      logFlagChange(key, "deny", "failed", error);
      return { reply: await usersPanel(key, FAILED), notice: "Failed" };
    }
    if (result === "ok") logFlagChange(key, "deny", "ok");
    const note = result === "ok" ? "Removed." : "That user was not on the list any more.";
    return { reply: await usersPanel(key, note), notice: note };
  }

  return {
    // The reply to one message of the owner. Never throws: a database failure is a reply that says so.
    async handle(text: string): Promise<BotReply> {
      const [command, a, b] = words(text);
      const waiting = pending && pending.expiresAt > now() ? pending : null;
      pending = null; // anything but /confirm cancels (and an expired one is gone)
      try {
        if (command === "/confirm") return { text: waiting ? await apply(waiting.key, "on") : "Nothing to confirm." };
        if (command === "/flags") return await panel();
        if (command === "/flag") return { text: await setMode(a, b) };
        if (command === "/allow") return { text: await allow(a, b, true) };
        if (command === "/deny") return { text: await allow(a, b, false) };
        return { text: HELP };
      } catch (error) {
        logFeatureFlagsError(error); // reading the flags for /flags failed; a change logs its own line
        return { text: FAILED };
      }
    },

    // A tap on one of the panel's buttons, by the data it carries. Unknown or malformed data is ignored. Never throws.
    async press(data: string): Promise<PressResult> {
      pending = null; // a tap cancels a pending /confirm like any other message
      const [kind, key, third, fourth] = data.split(":");
      try {
        if (kind === "p" && data === callbackData.panel) return { reply: await panel() };
        if (!key || !isFlagKey(key)) return {};
        if (kind === "m" && third && fourth && isFlagMode(third) && isFlagMode(fourth) && data === callbackData.mode(key, third, fourth)) {
          return await pressMode(key, third, fourth);
        }
        if (kind === "u" && data === callbackData.users(key)) return { reply: await usersPanel(key) };
        if (kind === "d" && third && UUID.test(third) && data === callbackData.remove(key, third)) return await pressRemove(key, third);
        return {};
      } catch (error) {
        logFeatureFlagsError(error);
        return { notice: "Failed" };
      }
    },
  };
}
