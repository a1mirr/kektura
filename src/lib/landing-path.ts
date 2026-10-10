// A path inside the site without the locale. It is only ever appended to our own origin and the validated locale, so
// it cannot point at another site.
export const landingPath = (next: unknown): string => (typeof next === "string" && next.startsWith("/") ? next : "/dashboard");
