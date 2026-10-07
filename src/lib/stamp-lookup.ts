// Which stamp a `?stamp=<code>` address means (spec 0017 AC-11): a code of a current stamp of the seed, with its name, or nothing.
import { getReferenceData } from "./dashboard-data";
import { parseStampCode } from "./feedback";

export async function findStamp(raw: unknown): Promise<{ code: string; name: string } | null> {
  const code = parseStampCode(raw);
  if (!code) return null;
  const { checkpoints } = await getReferenceData();
  const found = checkpoints.find((c) => c.code === code && c.retired_on == null);
  return found ? { code, name: found.name } : null;
}
