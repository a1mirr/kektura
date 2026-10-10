export const FLAG_MODES = ["off", "allowlist", "on"] as const;
export type FlagMode = (typeof FLAG_MODES)[number];

type FlagDefinition = { description: string; default: FlagMode };

export const FLAGS = {
  friends: { description: "Friends: share progress, compare with a friend (spec 0024)", default: "off" },
  restaurants: { description: "Restaurants layer on the trail map (spec 0003)", default: "off" },
  share: { description: "Share cards: a public link to a snapshot of your progress (spec 0039)", default: "off" },
} as const satisfies Record<string, FlagDefinition>;

export type FlagKey = keyof typeof FLAGS;
export const FLAG_KEYS = Object.keys(FLAGS) as FlagKey[];

export const isFlagKey = (key: string): key is FlagKey => Object.hasOwn(FLAGS, key);
export const isFlagMode = (mode: string): mode is FlagMode => (FLAG_MODES as readonly string[]).includes(mode);

export function isEnabled(mode: FlagMode, listed: boolean): boolean {
  return mode === "on" || (mode === "allowlist" && listed);
}

export type StoredFlag = { key: string; mode: string; listed: boolean };

export type Flags = Record<FlagKey, boolean>;

// `null` (the lookup failed) gives the defaults, so a new feature stays off.
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
