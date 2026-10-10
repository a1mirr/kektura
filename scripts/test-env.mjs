// Its URL and key come from `supabase status`, the dummy login is switched on and Next builds into its own folder, so
// the test server can run next to the normal dev server. Process env beats .env.local in Next, which is also how the
// Telegram secrets from .env.local are kept out of it (scripts/lib/test-server-env.mjs).
//
// Usage: node scripts/test-env.mjs [--e2e] <command...>
//   e.g. node scripts/test-env.mjs next dev --port 3001       (manual test server, .next-test)
//        node scripts/test-env.mjs --e2e next build            (E2E production build, .next-e2e)
import { spawn, spawnSync } from "node:child_process";
import { testServerEnv } from "./lib/test-server-env.mjs";

const status = spawnSync("npx supabase status -o json", { encoding: "utf8", shell: true });
const json = status.stdout.slice(status.stdout.indexOf("{"), status.stdout.lastIndexOf("}") + 1);
let local;
try {
  local = JSON.parse(json);
} catch {
  console.error("The local test Supabase isn't running. Start it with `npm run testdb:start` (needs Docker).");
  if (status.stderr) console.error(status.stderr.trim());
  process.exit(1);
}

const args = process.argv.slice(2);
const e2e = args[0] === "--e2e";
const env = testServerEnv(process.env, local, e2e);
const child = spawn((e2e ? args.slice(1) : args).join(" "), { stdio: "inherit", env, shell: true });
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
