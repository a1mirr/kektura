// The `friends` feature flag (spec 0024 AC-15). Until the flag mechanism of spec 0023 exists this is a plain
// server environment variable, read on every request: `FF_FRIENDS=1` switches the feature on, anything else
// leaves it off. Not exported from a "use server" file: that would make it a callable server action.
export function friendsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.FF_FRIENDS === "1";
}
