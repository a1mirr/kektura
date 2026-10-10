type Env = Record<string, string | undefined>;

const first = (value: string | null) => value?.split(",")[0]?.trim() || undefined;

// A host name, IPv4 address or [IPv6] address, with an optional port: nothing that could add a path, user
// info or another host to the redirect.
const HOST = /^(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:.]+\])(?::\d{1,5})?$/i;

export function requestOrigin(request: Request, env: Env = process.env): string {
  return originFromHeaders(request.headers, new URL(request.url).origin, env);
}

export function originFromHeaders(headers: Headers, own: string, env: Env = process.env): string {
  const configured = env.SITE_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch {
    }
  }

  const proto = first(headers.get("x-forwarded-proto"))?.toLowerCase() ?? own.slice(0, own.indexOf(":"));
  const host = first(headers.get("x-forwarded-host")) ?? first(headers.get("host"));
  if ((proto === "http" || proto === "https") && host && HOST.test(host)) return `${proto}://${host}`;
  return own;
}
