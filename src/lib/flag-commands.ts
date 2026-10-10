import { FLAG_KEYS, FLAG_MODES, FLAGS, isFlagKey, isFlagMode, type FlagKey, type FlagMode } from "./feature-flags";
import { logFeatureFlagsError, logFlagChange } from "./log";
import type { InlineKeyboard } from "./telegram";

// The texts are English: this is the owner's own tool, not part of the three-language rule.

export const CONFIRM_WINDOW_MS = 60_000;
export const MAX_LISTED_USERS = 20;
// Telegram refuses callback data over 64 bytes.
export const MAX_CALLBACK_BYTES = 64;

export type StoredFlagSummary = { key: string; mode: string; users: number };
export type ListedUser = { id: string; name: string };

// Every method throws when the database refuses.
export type FlagAdminStore = {
  list(): Promise<StoredFlagSummary[]>;
  setMode(key: FlagKey, mode: FlagMode): Promise<void>;
  setUser(key: FlagKey, email: string, allowed: boolean): Promise<"ok" | "no_account" | "no_flag">;
  listUsers(key: FlagKey): Promise<ListedUser[]>;
  removeUser(key: FlagKey, userId: string): Promise<"ok" | "not_listed">;
};

export type BotReply = { text: string; keyboard?: InlineKeyboard };
export type PressResult = { reply?: BotReply; notice?: string };

const HELP = [
  "Flag commands (/flags shows a panel with buttons for the same):",
  "/flags - every flag with its mode, a button each",
  "/flag <key> <off|allowlist|on> - set a mode (on asks for /confirm)",
  "/allow <key> <email> - add a user to a flag's allowlist",
  "/deny <key> <email> - remove a user from it",
].join("\n");

const FAILED = "Failed: nothing was changed. The reason is in the server log.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}$/;

// The data of the buttons: `f:<key>` opens one flag; `m:<key>:<mode>:<shown>` sets a mode, knowing the mode the
// view showed; `u:<key>` opens an allowlist; `d:<key>:<user id>` removes one user from it; `p` shows the list again.
export const callbackData = {
  flag: (key: FlagKey) => `f:${key}`,
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

  const summary = (rows: StoredFlagSummary[], key: FlagKey): string => {
    const row = rows.find((r) => r.key === key);
    const mode = modeOf(rows, key);
    return `${key}: ${mode}${mode === "allowlist" ? `, ${plural(row?.users ?? 0)}` : ""}${row ? "" : " (default)"}`;
  };

  async function panel(note?: string): Promise<BotReply> {
    const rows = await store.list();
    const keyboard: InlineKeyboard = FLAG_KEYS.map((key) => [{ text: summary(rows, key), callback_data: callbackData.flag(key) }]);
    return { text: [note, FLAG_KEYS.map((key) => summary(rows, key)).join("\n")].filter(Boolean).join("\n\n"), keyboard };
  }

  async function flagPanel(key: FlagKey, note?: string): Promise<BotReply> {
    const rows = await store.list();
    const mode = modeOf(rows, key);
    const users = rows.find((r) => r.key === key)?.users ?? 0;
    const keyboard: InlineKeyboard = [
      FLAG_MODES.map((target) => ({ text: target === mode ? `● ${target}` : target, callback_data: callbackData.mode(key, target, mode) })),
    ];
    if (mode === "allowlist" || users > 0) keyboard.push([{ text: `${key}: ${plural(users)}`, callback_data: callbackData.users(key) }]);
    keyboard.push([{ text: "‹ Back", callback_data: callbackData.panel }]);
    return { text: [note, `${summary(rows, key)}\n  ${FLAGS[key].description}`].filter(Boolean).join("\n\n"), keyboard };
  }

  async function usersPanel(key: FlagKey, note?: string): Promise<BotReply> {
    const users = await store.listUsers(key);
    const shown = users.slice(0, MAX_LISTED_USERS);
    const head = users.length === 0 ? `${key}: nobody on the allowlist.` : `${key}: ${plural(users.length)} on the allowlist.`;
    const more = users.length > shown.length ? `\nand ${users.length - shown.length} more` : "";
    const keyboard: InlineKeyboard = [
      ...shown.map((user) => [{ text: `Remove ${shorten(user.name)}`, callback_data: callbackData.remove(key, user.id) }]),
      [{ text: "‹ Back", callback_data: callbackData.flag(key) }],
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

  // The button knows the mode the panel showed: when the flag is in another mode now (changed in the dashboard, or
  // from another message) nothing is applied and the panel is shown as it is.
  async function pressMode(key: FlagKey, target: FlagMode, shown: FlagMode): Promise<PressResult> {
    const current = modeOf(await store.list(), key);
    if (current !== shown) return { reply: await flagPanel(key, `${key} is ${current} now, not ${shown}: nothing was changed.`), notice: "Changed since: nothing applied" };
    if (target === current) return { notice: `${key} is already ${current}` };
    if (target === "on") {
      return { reply: { text: askToConfirm(key), keyboard: [[{ text: "‹ Back", callback_data: callbackData.flag(key) }]] }, notice: "Send /confirm" };
    }
    const done = await apply(key, target);
    return { reply: await flagPanel(key, done), notice: done };
  }

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
    async handle(text: string): Promise<BotReply> {
      const [command, a, b] = words(text);
      const waiting = pending && pending.expiresAt > now() ? pending : null;
      pending = null;
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

    async press(data: string): Promise<PressResult> {
      pending = null;
      const [kind, key, third, fourth] = data.split(":");
      try {
        if (kind === "p" && data === callbackData.panel) return { reply: await panel() };
        if (!key || !isFlagKey(key)) return {};
        if (kind === "f" && data === callbackData.flag(key)) return { reply: await flagPanel(key) };
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
