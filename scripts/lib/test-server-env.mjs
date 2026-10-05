// The environment of the test server (spec 0006), kept apart from scripts/test-env.mjs so a unit test can
// call it without Docker or `supabase status`.

// Secrets of real services. Next merges .env.local into the server's environment, and a variable that is
// already set (even to "") wins over it, so blanking them here keeps tests away from the real service:
// without it every E2E run posts its feedback to the developer's real Telegram (spec 0017 AC-4 sends only
// when both are non-empty). The webhook secret and the service role key go too: the webhook (spec 0035) is then
// a 404 on the test server, and a test server on the local database never holds a production key.
export const BLANKED_SECRETS = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "TELEGRAM_WEBHOOK_SECRET", "SUPABASE_SERVICE_ROLE_KEY"];

export function testServerEnv(base, local, e2e) {
  return {
    ...base,
    ...Object.fromEntries(BLANKED_SECRETS.map((name) => [name, ""])),
    NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY ?? local.PUBLISHABLE_KEY,
    TEST_LOGIN: "1",
    // Separate folders: an E2E build must not clobber a running manual test server.
    NEXT_DIST_DIR: e2e ? ".next-e2e" : ".next-test",
  };
}
