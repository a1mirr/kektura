// Needs the test stack (`npm run testdb:start`, Docker); the local database is built from supabase/migrations, the
// source of truth.
//
// Usage: node scripts/db-types.mjs gen     rewrite the committed file (npm run types:gen)
//        node scripts/db-types.mjs check   fail when the committed file is stale (npm run types:check)
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/lib/supabase/database.types.ts";
const HEADER = `// Generated from the local test database (built from supabase/migrations) by
// \`npm run types:gen\`. Do not edit by hand: change a migration, \`npm run testdb:reset\`, then
// regenerate. \`npm run types:check\` (run in CI) fails when this file is stale.
`;

const mode = process.argv[2];
if (mode !== "gen" && mode !== "check") {
  console.error("Usage: node scripts/db-types.mjs gen|check");
  process.exit(2);
}

const result = spawnSync("npx supabase gen types typescript --local --schema public", {
  encoding: "utf8",
  shell: true,
  maxBuffer: 64 * 1024 * 1024,
});
if (result.status !== 0 || !result.stdout.trim()) {
  console.error("Could not generate the types from the local test database. Is it running? Start it with `npm run testdb:start` (needs Docker).");
  if (result.stderr) console.error(result.stderr.trim());
  process.exit(1);
}
const generated = HEADER + result.stdout.replace(/\r\n/g, "\n").replace(/\n*$/, "\n");

if (mode === "gen") {
  writeFileSync(FILE, generated);
  console.log(`Wrote ${FILE}`);
  process.exit(0);
}

let committed;
try {
  committed = readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");
} catch {
  committed = "";
}
if (committed === generated) {
  console.log(`${FILE} is up to date.`);
  process.exit(0);
}

const have = committed.split("\n");
const want = generated.split("\n");
let i = 0;
while (i < have.length && i < want.length && have[i] === want[i]) i++;
console.error(`${FILE} is out of date with supabase/migrations.`);
console.error(`First difference at line ${i + 1}:`);
console.error(`  committed: ${have[i] ?? "(end of file)"}`);
console.error(`  generated: ${want[i] ?? "(end of file)"}`);
console.error("Run `npm run types:gen` and commit the result.");
process.exit(1);
