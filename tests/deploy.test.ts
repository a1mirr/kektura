import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path: string) => fs.existsSync(new URL(`../${path}`, import.meta.url));

describe("spec 0020: deployment files", () => {
  it("AC-4, AC-6: everything for the server is in deploy/, and the root has no server scripts", () => {
    for (const file of ["post-receive", "Caddyfile", "server-setup.sh", "README.md"]) expect(exists(`deploy/${file}`), file).toBe(true);
    for (const file of ["post-receive", "server_setup.sh", "caddy_setup.sh", "caddy_fix.sh", "final_caddy.sh"]) {
      expect(exists(file), `${file} at the repository root`).toBe(false);
    }
  });

  it("AC-4: the repository root holds no shell script at all, and both server scripts parse (bash -n)", (ctx) => {
    expect(fs.readdirSync(new URL("../", import.meta.url)).filter((name) => name.endsWith(".sh"))).toEqual([]);
    if (spawnSync("bash", ["-c", "true"]).status !== 0) return ctx.skip();
    for (const script of ["deploy/post-receive", "deploy/server-setup.sh"]) {
      const path = new URL(`../${script}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
      expect(spawnSync("bash", ["-n", path], { encoding: "utf8" }).stderr, script).toBe("");
    }
  });

  it("AC-5: the deploy hook stops at the first failing step, after loading nvm", () => {
    const hook = read("deploy/post-receive");
    expect(hook).toMatch(/^set -euo pipefail$/m);
    // nvm isn't written for `set -u`, so it must be loaded before the flags are set.
    expect(hook.indexOf("nvm.sh")).toBeGreaterThan(-1);
    expect(hook.indexOf("nvm.sh")).toBeLessThan(hook.indexOf("set -euo pipefail"));
    expect(hook.indexOf("npm run build")).toBeLessThan(hook.indexOf("pm2 reload"));
    expect(hook).not.toMatch(/npm run build\s*\|\|/);
  });

  it("AC-5: the build gets a heap limit larger than the default on a 1 GB server, which the swap backs", () => {
    const hook = read("deploy/post-receive");
    expect(hook).toMatch(/^NODE_OPTIONS=--max-old-space-size=(\d+) npm run build$/m);
    const heap = Number(/--max-old-space-size=(\d+)/.exec(hook)![1]);
    expect(heap).toBeGreaterThanOrEqual(1024);
    expect(heap).toBeLessThanOrEqual(1024 + 2048); // RAM plus the swap that server-setup.sh creates
  });

  it("AC-5: only a push to main is deployed", () => {
    const hook = read("deploy/post-receive");
    expect(hook).toContain('"$ref" = "refs/heads/main"');
    expect(hook).toMatch(/exit 0/);
    expect(hook).toContain("checkout -f main");
  });

  it("AC-4: the proxy configuration is HTTPS (no HTTP-only site address) and points at the app", () => {
    const caddy = read("deploy/Caddyfile");
    const siteLine = caddy.split("\n").find((line) => line.includes("kektura-tracker.com") && line.includes("{"))!;
    expect(siteLine).not.toContain("http://");
    expect(siteLine).not.toMatch(/:80\b/);
    expect(caddy).toContain("reverse_proxy 127.0.0.1:3000");
  });

  it("AC-4: the swap script refuses to run as a normal user and can be run again", () => {
    const setup = read("deploy/server-setup.sh");
    expect(setup).toMatch(/^set -euo pipefail$/m);
    expect(setup).toContain('id -u');
    expect(setup).toContain('grep -q "swapfile" /etc/fstab');
  });

  it("the README documents the environment variables and the migrations-before-deploy rule", () => {
    const readme = read("deploy/README.md");
    for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SITE_URL", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "TEST_LOGIN"]) {
      expect(readme, name).toContain(name);
    }
    expect(readme).toMatch(/migrations? first/i);
  });
});
