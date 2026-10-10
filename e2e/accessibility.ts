import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

export const WIDTHS = { desktop: { width: 1280, height: 800 }, phone: { width: 375, height: 812 } } as const;
export type Width = keyof typeof WIDTHS;

const GATED = ["serious", "critical"];

export interface Finding {
  rule: string;
  impact: string;
  width: Width;
  help: string;
  elements: string[];
  count: number;
}

export interface Allowed {
  rule: string;
  page: string;
  width?: Width;
  reason: string;
  task?: string;
}

export function judge(page: string, findings: Finding[], allowList: readonly Allowed[]) {
  const gated = findings.filter((f) => GATED.includes(f.impact));
  const covers = (a: Allowed, f: Finding) => a.page === page && a.rule === f.rule && (a.width === undefined || a.width === f.width);
  return {
    unlisted: gated.filter((f) => !allowList.some((a) => covers(a, f))),
    stale: allowList.filter((a) => a.page === page && !gated.some((f) => covers(a, f))),
    ungated: findings.filter((f) => !GATED.includes(f.impact)),
  };
}

// The rules that are checked: the success criteria of WCAG 2.0, 2.1 and 2.2 at levels A and AA. Axe's "best-practice"
// rules are left out (they are advice, not a standard, and they roughly double the time a scan takes on the dashboard).
export const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

export async function scan(page: Page, width: Width, skip: string[] = []): Promise<Finding[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).disableRules(skip).analyze();
  return results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact ?? "minor",
    width,
    help: v.help,
    elements: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
    count: v.nodes.length,
  }));
}

export function describeFindings(findings: Finding[]) {
  return findings.map((f) => `${f.rule} (${f.impact}, ${f.width}, ${f.count} element${f.count === 1 ? "" : "s"}): ${f.help} - ${f.elements.join(" | ")}`);
}
