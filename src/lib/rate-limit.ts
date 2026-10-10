// One server process, forgotten on restart: it only blunts abuse of the public feedback form, the database
// constraints are the real limit.

export function createRateLimiter({
  limit,
  windowMs,
  now = Date.now,
}: {
  limit: number;
  windowMs: number;
  now?: () => number;
}) {
  const hits = new Map<string, number[]>();

  const recent = (key: string, at: number) => (hits.get(key) ?? []).filter((t) => at - t < windowMs);

  return {
    allow(key: string): boolean {
      const at = now();
      const inWindow = recent(key, at);
      if (inWindow.length >= limit) {
        hits.set(key, inWindow);
        return false;
      }
      hits.set(key, [...inWindow, at]);
      // Keep the map from growing without bound: drop keys whose hits have all expired.
      if (hits.size > 5000) for (const k of hits.keys()) if (recent(k, at).length === 0) hits.delete(k);
      return true;
    },
  };
}
