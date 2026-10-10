export const landingPath = (next: unknown): string => (typeof next === "string" && next.startsWith("/") ? next : "/dashboard");
