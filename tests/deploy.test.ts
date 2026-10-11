import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path: string) => fs.existsSync(new URL(`../${path}`, import.meta.url));

/** The top-level blocks of deploy/Caddyfile: the global options block has the address "". */
function caddyBlocks() {
  const blocks: { address: string; body: string }[] = [];
  let current: { address: string; lines: string[] } | null = null;
  for (const line of read("deploy/Caddyfile").split(/\r?\n/)) {
    if (!current && /^\S.*\{$/.test(line) && !line.startsWith("#")) current = { address: line.slice(0, -1).trim(), lines: [] };
    else if (!current && line === "{") current = { address: "", lines: [] };
    else if (current && line === "}") {
      blocks.push({ address: current.address, body: current.lines.join("\n") });
      current = null;
    } else if (current) current.lines.push(line);
  }
  return blocks;
}

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

  it("AC-4: the site block that points at the app has an HTTPS address (not http:// or port 80)", () => {
    const app = caddyBlocks().find((block) => block.body.includes("reverse_proxy 127.0.0.1:3000"))!;
    expect(app, "a site block that proxies to the app").toBeDefined();
    expect(app.address).toContain("kektura-tracker.com");
    expect(app.address).not.toContain("http://");
    expect(app.address).not.toMatch(/:80\b/);
  });

  it("AC-7: HTTPS only on 127.0.0.1:8443, PROXY protocol from 127.0.0.1 alone, no HTTP/3", () => {
    const blocks = caddyBlocks();
    const global = blocks.find((block) => block.address === "")!;
    expect(global.body).toMatch(/^\s*https_port 8443$/m);
    expect(global.body).toMatch(/^\s*servers 127\.0\.0\.1:8443 \{$/m);
    expect(global.body).toMatch(/^\s*protocols h1 h2$/m);
    expect(global.body).toMatch(/proxy_protocol \{\s*allow 127\.0\.0\.1\/32\s*\}/);
    // The proxy_protocol wrapper must come before tls, or the PROXY header reaches the TLS handshake.
    expect(global.body.indexOf("proxy_protocol")).toBeLessThan(global.body.indexOf("tls"));
    const app = blocks.find((block) => block.body.includes("reverse_proxy 127.0.0.1:3000"))!;
    expect(app.address).toBe("kektura-tracker.com:8443, www.kektura-tracker.com:8443");
    expect(app.body).toMatch(/^\s*bind 127\.0\.0\.1$/m);
  });

  it("AC-7: port 80 redirects both names to HTTPS", () => {
    const redirect = caddyBlocks().find((block) => block.address.startsWith("http://"))!;
    expect(redirect.address).toBe("http://kektura-tracker.com, http://www.kektura-tracker.com");
    expect(redirect.body).toMatch(/^\s*redir https:\/\/\{host\}\{uri\} permanent$/m);
    // Caddy's own redirect would send people to :8443, the port HTTPS listens on.
    expect(caddyBlocks().find((block) => block.address === "")!.body).toMatch(/^\s*auto_https disable_redirects$/m);
  });

  it("AC-7: the site imports server-only additions, and the README validates the new file before installing it", () => {
    const app = caddyBlocks().find((block) => block.body.includes("reverse_proxy 127.0.0.1:3000"))!;
    expect(app.body).toMatch(/^\s*import \/etc\/caddy\/site\.d\/\*\.caddy$/m);
    const readme = read("deploy/README.md");
    expect(readme).toContain("sudo mkdir -p /etc/caddy/site.d");
    const install = /sudo caddy validate --config Caddyfile --adapter caddyfile && sudo cp Caddyfile \/etc\/caddy\/Caddyfile && sudo systemctl reload caddy/;
    expect(readme).toMatch(install);
    expect(read("deploy/Caddyfile")).toContain("# Install: sudo caddy validate --config Caddyfile --adapter caddyfile && sudo cp");
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
