// Claude Code Stop hook: the regression gate of the spec-driven workflow (specs/README.md).
//
// When Claude is about to finish and source files differ from the last green run, run typecheck,
// lint and unit tests in parallel (E2E needs Docker and is run by hand: `npm run e2e`). On failure exit 2: stderr goes back to Claude, which keeps working.
// After MAX_ATTEMPTS failed attempts in a row it lets the turn end and tells the user instead of
// looping. Once checks pass, app code changed without any spec or test change gets one nudge.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const MAX_ATTEMPTS = 3;
const WATCHED = [
  "specs",
  "src",
  "tests",
  "e2e",
  "scripts",
  "supabase",
  "messages",
  "public/data",
  "package.json",
  "tsconfig.json",
  "vitest.config.mts",
  "playwright.config.ts",
  "next.config.ts",
  "eslint.config.mjs",
];
const CHECKS = [
  ["typecheck", "npx tsc --noEmit"],
  ["lint", "npx eslint ."],
  ["tests", "npx vitest run"],
];

const root = process.env.CLAUDE_PROJECT_DIR || path.resolve(import.meta.dirname, "../..");
process.chdir(root);
const stateFile = path.join("node_modules", ".cache", "claude-stop-check.json");

const input = (() => {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
})();
const state = (() => {
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {
    return {};
  }
})();
const save = () => {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state));
};

// Changed (vs HEAD) or untracked watched files.
const status = spawnSync("git", ["-c", "core.quotepath=false", "status", "--porcelain=v1", "-uall", "--", ...WATCHED], {
  encoding: "utf8",
});
if (status.status !== 0) process.exit(0); // not a git checkout: nothing to compare against
const changed = status.stdout
  .split("\n")
  .filter(Boolean)
  .map((line) => line.slice(3).replace(/^.* -> /, "").replace(/^"|"$/g, ""));
if (!changed.length) process.exit(0);

// Fingerprint of the working tree: same paths with the same mtimes/sizes = already checked.
const hash = createHash("sha1");
for (const file of changed.sort()) {
  const st = fs.statSync(file, { throwIfNoEntry: false });
  hash.update(`${file}:${st ? `${st.mtimeMs}:${st.size}` : "deleted"}\n`);
}
const fingerprint = hash.digest("hex");
if (state.green === fingerprint) process.exit(0);

const run = ([name, command]) =>
  new Promise((resolve) => {
    const env = { ...process.env, NO_COLOR: "1", CI: "1" };
    delete env.FORCE_COLOR;
    const child = spawn(command, { shell: true, env });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ name, command, code, out }));
  });
const failures = (await Promise.all(CHECKS.map(run))).filter((r) => r.code !== 0);

if (failures.length) {
  state.attempts = input.stop_hook_active ? (state.attempts ?? 0) + 1 : 1;
  save();
  if (state.attempts > MAX_ATTEMPTS) {
    console.log(
      JSON.stringify({
        systemMessage: `Stop hook: ${failures.map((f) => f.name).join(", ")} still failing after ${MAX_ATTEMPTS} attempts; run \`npm run check\` to see why.`,
      }),
    );
    process.exit(0);
  }
  const tail = (s) => s.trim().split("\n").slice(-60).join("\n");
  console.error(
    `Regression gate failed (attempt ${state.attempts}/${MAX_ATTEMPTS}). Fix these before finishing:\n\n` +
      failures.map((f) => `### ${f.name} (\`${f.command}\`)\n${tail(f.out)}`).join("\n\n"),
  );
  process.exit(2);
}

state.green = fingerprint;
state.attempts = 0;
save();

// Spec-driven nudge (once per change set): app code changed, but no spec and no test did.
const isTest = (f) => /\.test\.[cm]?[jt]sx?$/.test(f) || f.startsWith("tests/") || f.startsWith("e2e/");
const appCode = changed.filter((f) => /^src\/.*\.(ts|tsx)$/.test(f) && !isTest(f) && !f.endsWith(".types.ts"));
const specOrTest = changed.some((f) => f.startsWith("specs/") || isTest(f));
if (appCode.length && !specOrTest && !input.stop_hook_active) {
  console.error(
    `Checks pass, but app code changed without a spec or test change:\n  ${appCode.join("\n  ")}\n\n` +
      "If behaviour changed: update or add the spec in specs/ (acceptance criteria) and the tests that cite it. " +
      "If not (refactor, copy or styling only), say so in one line and finish.",
  );
  process.exit(2);
}
process.exit(0);
