// Usage: node scripts/check-audit.mjs [audit-report.json] [allowlist.json]
import { readFileSync } from "node:fs";

export const SEVERITIES_THAT_FAIL = ["high", "critical"];
export const MAX_DAYS_AHEAD = 90;

const GHSA = /GHSA(?:-[2-9cfghjmpqrvwx]{4}){3}/i;
const ENTRY_KEYS = ["advisory", "reason", "expires"];

/** Today as `YYYY-MM-DD` in UTC: an entry runs through the end of its `expires` day, and fails from the next day. */
export function dayOf(now) {
  return now.toISOString().slice(0, 10);
}

function isRealDate(text) {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

/**
 * The allow-list: `{ entries: [{ advisory, reason, expires }] }`. Returns the entries that still count and a list of
 * what is wrong with the file (an unreadable shape, a malformed entry, an expired one).
 */
export function readAllowlist(allowlist, now) {
  const today = dayOf(now);
  const latest = dayOf(new Date(now.getTime() + MAX_DAYS_AHEAD * 86_400_000));
  const problems = [];
  const active = [];
  if (!allowlist || typeof allowlist !== "object" || !Array.isArray(allowlist.entries)) {
    return { active, problems: ['the allow-list must be an object with an "entries" array'] };
  }
  allowlist.entries.forEach((entry, i) => {
    const where = `allow-list entry ${i + 1}`;
    if (!entry || typeof entry !== "object") return problems.push(`${where} is not an object`);
    const unknown = Object.keys(entry).filter((key) => !ENTRY_KEYS.includes(key));
    if (unknown.length > 0) return problems.push(`${where} has unknown fields: ${unknown.join(", ")}`);
    const id = typeof entry.advisory === "string" && new RegExp(`^${GHSA.source}$`, "i").test(entry.advisory) ? entry.advisory.toLowerCase() : null;
    if (!id) return problems.push(`${where} needs an "advisory" that is a GitHub advisory id (GHSA-xxxx-xxxx-xxxx)`);
    const named = `allow-list entry ${entry.advisory}`;
    if (typeof entry.reason !== "string" || entry.reason.trim() === "") return problems.push(`${named} needs a "reason"`);
    if (!isRealDate(entry.expires)) return problems.push(`${named} needs an "expires" date written YYYY-MM-DD`);
    if (entry.expires < today) {
      return problems.push(`${named} expired on ${entry.expires}: fix the advisory, or renew the entry with a new reason and date`);
    }
    if (entry.expires > latest) {
      return problems.push(`${named} expires on ${entry.expires}, more than ${MAX_DAYS_AHEAD} days from now: pick a date within ${MAX_DAYS_AHEAD} days`);
    }
    active.push({ advisory: id, reason: entry.reason, expires: entry.expires });
  });
  return { active, problems };
}

export function advisoriesOf(report) {
  const found = new Map();
  for (const [name, vulnerability] of Object.entries(report.vulnerabilities ?? {})) {
    for (const via of vulnerability.via ?? []) {
      if (typeof via !== "object" || via === null || !SEVERITIES_THAT_FAIL.includes(via.severity)) continue;
      const id = (typeof via.url === "string" && via.url.match(GHSA)?.[0]) || null;
      const key = id ? id.toLowerCase() : `npm:${via.source ?? `${via.name}:${via.title}`}`;
      if (!found.has(key)) {
        found.set(key, { id: id ?? null, package: via.name ?? name, severity: via.severity, title: via.title ?? "", url: via.url ?? "" });
      }
    }
  }
  return [...found.entries()].map(([key, advisory]) => ({ key, ...advisory }));
}

export function auditProblems(report, allowlist, now = new Date()) {
  if (!report || typeof report !== "object" || report.error || typeof report.vulnerabilities !== "object" || !report.metadata?.vulnerabilities) {
    const why = report?.error ? ` (${[report.error.code, report.error.summary].filter(Boolean).join(": ")})` : "";
    return [`npm audit did not produce a report${why}: the check cannot say the dependencies are safe`];
  }
  const { active, problems } = readAllowlist(allowlist, now);
  const findings = advisoriesOf(report);
  const counts = report.metadata.vulnerabilities;
  const flagged = SEVERITIES_THAT_FAIL.reduce((sum, level) => sum + (Number(counts[level]) || 0), 0);
  if (flagged > 0 && findings.length === 0) {
    problems.push(`npm audit counts ${flagged} high or critical vulnerabilities but the report names no advisory: the check cannot read it`);
  }
  for (const finding of findings) {
    if (finding.id && active.some((entry) => entry.advisory === finding.id.toLowerCase())) continue;
    const link = finding.url ? ` (${finding.url})` : "";
    problems.push(`${finding.severity} vulnerability in ${finding.package}: ${finding.title}${link}`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/").split("/").pop())) {
  const read = (file, what) => {
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch {
      throw new Error(`${file} is missing or not JSON: ${what}`);
    }
  };
  const report = read(process.argv[2] ?? "audit-report.json", "npm audit did not report");
  const allowlist = read(process.argv[3] ?? ".github/audit-allowlist.json", "the allow-list must be a JSON file");
  const problems = auditProblems(report, allowlist);
  if (problems.length > 0) {
    throw new Error(`npm audit --omit=dev --audit-level=high found problems:\n- ${problems.join("\n- ")}`);
  }
  const allowed = readAllowlist(allowlist, new Date()).active.length;
  console.log(`No high or critical vulnerability in the production dependencies${allowed > 0 ? ` (${allowed} allow-listed)` : ""}.`);
}
