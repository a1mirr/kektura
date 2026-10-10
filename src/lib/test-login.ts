// Dummy sign-in for the local test server. Production never has it: it needs
// TEST_LOGIN=1 *and* a Supabase running on this machine, so a stray flag can't open it remotely.

export const TEST_EMAIL = "tester@kektura.test";
// Every dummy account shares this password; the accounts only exist in the local test database.
export const TEST_PASSWORD = "kektura-test-password";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

type Env = Record<string, string | undefined>;

export function testLoginEnabled(env: Env = process.env): boolean {
  if (env.TEST_LOGIN !== "1") return false;
  try {
    return LOCAL_HOSTS.has(new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname);
  } catch {
    return false;
  }
}

export const isTestEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
