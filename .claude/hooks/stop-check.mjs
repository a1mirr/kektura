import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { nudgeKey, nudgeToAsk } from "./stop-nudges.mjs";

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

const status = spawnSync("git", ["-c", "core.quotepath=false", "status", "--porcelain=v1", "-uall", "--", ...WATCHED], {
  encoding: "utf8",
});
if (status.status !== 0) process.exit(0); // not a git checkout: nothing to compare against
const changed = status.stdout
  .split("\n")
  .filter(Boolean)
  .map((line) => line.slice(3).replace(/^.* -> /, "").replace(/^"|"$/g, ""));

const committed = (() => {
  const base = spawnSync("git", ["merge-base", "HEAD", "origin/main"], { encoding: "utf8" });
  if (base.status !== 0) return [];
  const diff = spawnSync("git", ["-c", "core.quotepath=false", "diff", "--name-only", base.stdout.trim(), "HEAD", "--", ...WATCHED], {
    encoding: "utf8",
  });
  return diff.status === 0 ? diff.stdout.split("\n").filter(Boolean) : [];
})();
if (!changed.length && !committed.length) process.exit(0);

function askOnce() {
  const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
  const scope = `${head}:${fingerprint}`;
  const message = input.stop_hook_active ? "" : nudgeToAsk(changed, committed, state.nudged, scope);
  if (!message) return;
  state.nudged = nudgeKey(scope, message);
  save();
  console.error(message);
  process.exit(2);
}

const hash = createHash("sha1");
for (const file of changed.sort()) {
  const st = fs.statSync(file, { throwIfNoEntry: false });
  hash.update(`${file}:${st ? `${st.mtimeMs}:${st.size}` : "deleted"}\n`);
}
const fingerprint = hash.digest("hex");
if (!changed.length || state.green === fingerprint) {
  askOnce();
  process.exit(0);
}

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

askOnce();
process.exit(0);
