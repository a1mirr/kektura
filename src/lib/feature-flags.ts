// Feature flags (spec 0035): a feature can be merged and deployed dark, then switched on for the developer, for
// chosen testers and for everybody, without a deploy. Which flags exist is declared here, once; how each is
// switched lives in the database (`feature_flags`, `feature_flag_users`). A flag is temporary: when its feature is
// live for everyone, the flag, its checks and its rows are deleted.
//
// This file is pure (no database, no Next); the server side that reads the state is `feature-flags-server.ts`.

export const FLAG_MODES = ["off", "allowlist", "on"] as const;
// `off`: nobody. `allowlist`: only the listed users. `on`: everybody, signed-out visitors included.
export type FlagMode = (typeof FLAG_MODES)[number];

type FlagDefinition = { description: string; default: FlagMode };

// The registry. The key type is derived from it, so asking for a flag that is not declared fails typecheck.
// A migration inserts a row for a new flag (an allowlist needs one); without a row the default applies.
export const FLAGS = {
  friends: { description: "Friends: share progress, compare with a friend (spec 0024)", default: "off" },
  restaurants: { description: "Restaurants near the trail on the map (planned)", default: "off" },
} as const satisfies Record<string, FlagDefinition>;

export type FlagKey = keyof typeof FLAGS;
export const FLAG_KEYS = Object.keys(FLAGS) as FlagKey[];

export const isFlagKey = (key: string): key is FlagKey => Object.hasOwn(FLAGS, key);
export const isFlagMode = (mode: string): mode is FlagMode => (FLAG_MODES as readonly string[]).includes(mode);

// `listed`: the viewer is on the flag's allowlist; always false for a signed-out visitor.
export function isEnabled(mode: FlagMode, listed: boolean): boolean {
  return mode === "on" || (mode === "allowlist" && listed);
}

// One stored flag as `feature_flags_for_me()` returns it for the viewer.
export type StoredFlag = { key: string; mode: string; listed: boolean };

export type Flags = Record<FlagKey, boolean>;

// Every declared flag for one viewer. A flag with no stored row, or a row with a mode the code does not know,
// uses its default; stored keys that are not declared are ignored. `null` (the lookup failed) gives the defaults,
// so a new feature stays off.
export function resolveFlags(stored: readonly StoredFlag[] | null): Flags {
  const rows = new Map((stored ?? []).map((row) => [row.key, row]));
  return Object.fromEntries(
    FLAG_KEYS.map((key) => {
      const row = rows.get(key);
      const mode = row && isFlagMode(row.mode) ? row.mode : FLAGS[key].default;
      return [key, isEnabled(mode, row?.listed === true)];
    }),
  ) as Flags;
}
