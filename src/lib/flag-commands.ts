import { FLAG_KEYS, FLAG_MODES, FLAGS, isFlagKey, isFlagMode, type FlagKey, type FlagMode } from "./feature-flags";
import { logFeatureFlagsError, logFlagChange } from "./log";

// The commands the owner sends the Telegram bot to look at and switch feature flags (spec 0035 AC-17 to AC-22).
// Pure apart from the store it is given and the clock, so every reply is unit-tested. The texts are English: this is
// the owner's own tool, not part of the three-language rule.

export const CONFIRM_WINDOW_MS = 60_000;

export type StoredFlagSummary = { key: string; mode: string; users: number };

// What the bot needs from the database (spec 0035 AC-23). Every method throws when the database refuses.
export type FlagAdminStore = {
  list(): Promise<StoredFlagSummary[]>;
  setMode(key: FlagKey, mode: FlagMode): Promise<void>;
  setUser(key: FlagKey, email: string, allowed: boolean): Promise<"ok" | "no_account" | "no_flag">;
};

const HELP = [
  "Flag commands:",
  "/flags - every flag with its mode",
  "/flag <key> <off|allowlist|on> - set a mode (on asks for /confirm)",
  "/allow <key> <email> - add a user to a flag's allowlist",
  "/deny <key> <email> - remove a user from it",
].join("\n");

const FAILED = "Failed: nothing was changed. The reason is in the server log.";

// "/flag@kektura_bot friends on" in a group chat: the bot's name is not part of the command.
function words(text: string): string[] {
  const [command = "", ...rest] = text.trim().split(/\s+/);
  return [command.toLowerCase().replace(/@\w+$/, ""), ...rest];
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}$/;

export function createFlagBot({ store, now = Date.now }: { store: FlagAdminStore; now?: () => number }) {
  let pending: { key: FlagKey; expiresAt: number } | null = null;

  async function show(): Promise<string> {
    const stored = new Map((await store.list()).map((row) => [row.key, row]));
    return FLAG_KEYS.map((key) => {
      const row = stored.get(key);
      const mode = row && isFlagMode(row.mode) ? row.mode : FLAGS[key].default;
      const users = mode === "allowlist" ? `, ${row?.users ?? 0} user${row?.users === 1 ? "" : "s"}` : "";
      return `${key}: ${mode}${users}${row ? "" : " (default)"}\n  ${FLAGS[key].description}`;
    }).join("\n");
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

  async function setMode(key: string | undefined, mode: string | undefined): Promise<string> {
    if (!key || !isFlagKey(key)) return `Unknown flag. Declared flags: ${FLAG_KEYS.join(", ")}.`;
    if (!mode || !isFlagMode(mode)) return `Unknown mode. Valid modes: ${FLAG_MODES.join(", ")}.`;
    if (mode === "on") {
      // On is for everybody, signed-out visitors included: it takes a second message (spec 0035 AC-20).
      pending = { key, expiresAt: now() + CONFIRM_WINDOW_MS };
      return `${key} would be on for everybody, signed-out visitors included. Send /confirm within ${CONFIRM_WINDOW_MS / 1000} seconds to do it; anything else cancels.`;
    }
    return apply(key, mode);
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
      const mode = await store.list().then((rows) => rows.find((row) => row.key === key)?.mode ?? FLAGS[key].default, () => null);
      const note = allowed && mode && mode !== "allowlist" ? ` The flag is ${mode}, so this has no effect until it is set to allowlist.` : "";
      return `${email} ${allowed ? "added to" : "removed from"} the allowlist of ${key}.${note}`;
    } catch (error) {
      logFlagChange(key, change, "failed", error);
      return FAILED;
    }
  }

  return {
    // The reply to one message of the owner. Never throws: a database failure is a reply that says so.
    async handle(text: string): Promise<string> {
      const [command, a, b] = words(text);
      const waiting = pending && pending.expiresAt > now() ? pending : null;
      pending = null; // anything but /confirm cancels (and an expired one is gone)
      try {
        if (command === "/confirm") {
          return waiting ? await apply(waiting.key, "on") : "Nothing to confirm.";
        }
        if (command === "/flags") return await show();
        if (command === "/flag") return await setMode(a, b);
        if (command === "/allow") return await allow(a, b, true);
        if (command === "/deny") return await allow(a, b, false);
        return HELP;
      } catch (error) {
        logFeatureFlagsError(error); // reading the flags for /flags failed; a change logs its own line
        return FAILED;
      }
    },
  };
}
