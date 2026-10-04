// The pure decisions of the automatic deploy (spec 0026): what is deployed, which migrations are missing,
// what a failure message says. No I/O here, so the tests can state every rule directly.

// Changes that don't need a deploy (AC-12): documentation, specs, tests and repository tooling.
const NOT_DEPLOYED = [/^specs\//, /^tests\//, /^e2e\//, /^\.github\//, /^\.claude\//, /^\.githooks\//, /\.md$/];

/** True when at least one changed path is something production runs. */
export function needsDeploy(paths) {
  return paths.some((path) => !NOT_DEPLOYED.some((pattern) => pattern.test(path)));
}

/**
 * What to do for `target` (a commit of main), given what production runs (AC-12).
 * `changed` are the paths that differ between production's commit and the target;
 * `targetIsBehind` is true when the target is an ancestor of production's commit.
 * @param {{ production: string, target: string, changed?: string[], targetIsBehind?: boolean }} input
 * @returns {{ deploy: boolean, reason: string }}
 */
export function planDeploy({ production, target, changed = [], targetIsBehind = false }) {
  if (!production) return { deploy: true, reason: "production has no main yet" };
  if (production === target) return { deploy: false, reason: "production already runs this commit" };
  if (targetIsBehind) return { deploy: false, reason: "production already runs a newer commit" };
  if (!needsDeploy(changed)) {
    return { deploy: false, reason: "only documentation, specs, tests and repository tooling changed" };
  }
  return { deploy: true, reason: `${changed.length} changed file${changed.length === 1 ? "" : "s"} since production's commit` };
}

// 0001_init.sql, 0024_friends.sql ...: four digits (the number of the task issue that adds it), then a slug.
const MIGRATION_FILE = /^\d{4}_[a-z0-9_]+\.sql$/;

/** The migration files among `names`, in the order they are applied: by name (AC-4). */
export function migrationFiles(names) {
  return names.filter((name) => MIGRATION_FILE.test(name)).sort();
}

/** The files still to apply, in name order. A file that sorts before an applied one is still pending (AC-6). */
export function pendingMigrations(files, applied) {
  return files.filter((file) => !applied.has(file));
}

/** `baseline` and every file that sorts before it (AC-13). */
export function baselineFiles(files, baseline) {
  if (!files.includes(baseline)) {
    throw new Error(`The baseline ${JSON.stringify(baseline)} is not a file in supabase/migrations/.`);
  }
  return files.filter((file) => file <= baseline);
}

/** `text` with the connection string, the password and the user:password part replaced (AC-13). */
export function redact(text, connectionString) {
  const secrets = new Set([connectionString]);
  try {
    const url = new URL(connectionString);
    for (const secret of [url.password, decodeURIComponent(url.password), url.username && `${url.username}:${url.password}`]) {
      if (secret) secrets.add(secret);
    }
  } catch {
    // not a URL: only the whole string is redacted
  }
  let out = text;
  for (const secret of [...secrets].filter(Boolean).sort((a, b) => b.length - a.length)) out = out.split(secret).join("***");
  return out;
}

const STEPS = { pick: "choosing the commit to deploy", ci: "checking that CI passed", plan: "reaching production", missing: "checking which migrations are missing", backup: "backing up the user data before the migrations (no migration was applied)", migrate: "applying migrations", push: "pushing the code to production", smoke: "the smoke test" };

/**
 * The Telegram message for a failed run (AC-9): the commit, the failed step, a link. `outcomes` maps step id to its outcome.
 * @param {{ sha: string, runUrl: string, outcomes: Record<string, string | undefined> }} input
 */
export function failureMessage({ sha, runUrl, outcomes }) {
  const failed = Object.keys(STEPS).find((id) => outcomes[id] === "failure");
  const step = failed ? STEPS[failed] : "an unknown step";
  return `Deploy of ${String(sha).slice(0, 7)} failed while ${step}. Nothing was rolled back by itself. ${runUrl}`;
}
