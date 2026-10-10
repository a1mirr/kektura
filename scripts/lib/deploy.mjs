const NOT_DEPLOYED = [/^specs\//, /^tests\//, /^e2e\//, /^\.github\//, /^\.claude\//, /^\.githooks\//, /\.md$/];

export function needsDeploy(paths) {
  return paths.some((path) => !NOT_DEPLOYED.some((pattern) => pattern.test(path)));
}

/**
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

const MIGRATION_FILE = /^\d{4}_[a-z0-9_]+\.sql$/;

export function migrationFiles(names) {
  return names.filter((name) => MIGRATION_FILE.test(name)).sort();
}

export function pendingMigrations(files, applied) {
  return files.filter((file) => !applied.has(file));
}

export function baselineFiles(files, baseline) {
  if (!files.includes(baseline)) {
    throw new Error(`The baseline ${JSON.stringify(baseline)} is not a file in supabase/migrations/.`);
  }
  return files.filter((file) => file <= baseline);
}

// `text` without psql's `DETAIL:` part, which quotes the values of the row that failed (a public repository's logs
// are public). A value can hold newlines, so the part runs from the `DETAIL:` line to the next line that starts with
// one of psql's other labels (or to the end).
export function dropDetails(text) {
  let inDetail = false;
  return text
    .split("\n")
    .filter((line) => {
      if (/^\s*DETAIL:/.test(line)) inDetail = true;
      else if (/^\s*(HINT|CONTEXT|QUERY|LOCATION|STATEMENT|LINE \d+|psql:[^\n]*|ERROR|WARNING|NOTICE):/.test(line)) inDetail = false;
      return !inDetail;
    })
    .join("\n");
}

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
 * @param {{ sha: string, runUrl: string, outcomes: Record<string, string | undefined> }} input
 */
export function failureMessage({ sha, runUrl, outcomes }) {
  const failed = Object.keys(STEPS).find((id) => outcomes[id] === "failure");
  const step = failed ? STEPS[failed] : "an unknown step";
  return `Deploy of ${String(sha).slice(0, 7)} failed while ${step}. Nothing was rolled back by itself. ${runUrl}`;
}
