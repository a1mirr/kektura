// Where to land after signing in (spec 0005 AC-4): the `next` a page asked for, a path inside the site without
// the locale (an invite link, spec 0024), else the dashboard. It is only ever appended to our own origin and
// the validated locale, so it cannot point at another site.
export const landingPath = (next: unknown): string => (typeof next === "string" && next.startsWith("/") ? next : "/dashboard");
