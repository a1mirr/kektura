import { expect, test, type Page } from "@playwright/test";
import { routing } from "../src/i18n/routing";
import { describeFindings, judge, scan, WIDTHS, type Finding, type Width } from "./accessibility";
import { ALLOWED } from "./accessibility-allowlist";
import { expandAllStages, seedStatsWalk, signInAsNewUser } from "./helpers";

// Spec 0006 AC-11, AC-12: axe on the main pages, at the desktop width and at the phone width. A "serious" or "critical"
// violation that is not in the allow-list fails the page's test, and so does an allow-list entry that no longer fires.

// Each page: its name (what the allow-list says), how to open it and what to wait for so that the scan sees the finished page.
interface Target {
  name: string;
  signedIn: boolean;
  open: (page: Page) => Promise<void>;
  /** What a signed-in page needs in the database before it is opened (the stats page: months to draw). */
  seed?: (email: string) => void;
  /** Rules left out at the phone width: the colours do not change with the width, so a rule that costs a lot is run once. */
  skipAtPhone?: string[];
}

const landing = (locale: string): Target => ({
  name: `landing-${locale}`,
  signedIn: false,
  open: async (page) => {
    await page.goto(`/${locale}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  },
});

const TARGETS: Target[] = [
  ...routing.locales.map(landing),
  {
    name: "dashboard",
    signedIn: true,
    // Axe takes about half of its time on this page (2,900 elements) for the contrast of the text; the list's colours are the same at every width.
    skipAtPhone: ["color-contrast"],
    // every stage open and one place stamped, so that the rows' controls (stamp, date, remove) are on the page too
    open: async (page) => {
      await page.goto("/en/dashboard");
      await expect(page.locator(".maplibregl-canvas")).toBeVisible();
      await expandAllStages(page);
      const row = page.locator("#place-OKTPH_02");
      await expect(row.getByRole("button", { name: /^(Add stamp|Remove)$/ })).toBeVisible();
      const add = row.getByRole("button", { name: "Add stamp" });
      if (await add.count()) await add.click(); // already stamped on the second visit, at the other width
      await expect(row.getByRole("button", { name: "Remove" })).toBeVisible();
    },
  },
  {
    // "Change dates" (spec 0016 AC-14 to AC-21): the mode with its checkboxes, the stage buttons and the bar, one stamp chosen
    name: "dashboard-change-dates",
    signedIn: true,
    skipAtPhone: ["color-contrast"],
    open: async (page) => {
      await page.goto("/en/dashboard");
      await expect(page.locator(".maplibregl-canvas")).toBeVisible();
      await expandAllStages(page);
      const row = page.locator("#place-OKTPH_02");
      await expect(row.getByRole("button", { name: /^(Add stamp|Remove)$/ })).toBeVisible();
      const add = row.getByRole("button", { name: "Add stamp" });
      if (await add.count()) await add.click(); // already stamped on the second visit, at the other width
      await expect(row.getByRole("button", { name: "Remove" })).toBeVisible();
      await page.getByRole("button", { name: "Change dates" }).click();
      const bar = page.getByRole("region", { name: "Change the date of several stamps" });
      await expect(bar).toBeVisible();
      await row.getByRole("checkbox").check();
      await bar.getByLabel("New date of the selected stamps").fill("2024-03-05");
      await expect(bar.getByRole("button", { name: "Apply" })).toBeEnabled();
    },
  },
  {
    // Spec 0037: the chart drawn (six months, one empty), its bars are buttons in a scrollable frame
    name: "stats",
    signedIn: true,
    seed: seedStatsWalk,
    open: async (page) => {
      await page.goto("/en/stats");
      await expect(page.locator("[data-month]")).toHaveCount(6);
    },
  },
  {
    name: "account",
    signedIn: true,
    open: async (page) => {
      await page.goto("/en/account");
      await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
    },
  },
  {
    name: "friends",
    signedIn: true,
    open: async (page) => {
      await page.goto("/en/friends");
      await expect(page.getByRole("heading", { name: "Your friends" })).toBeVisible();
    },
  },
  {
    name: "changelog",
    signedIn: false,
    open: async (page) => {
      await page.goto("/en/changelog");
      await expect(page.getByRole("heading", { level: 1, name: "Changelog" })).toBeVisible();
    },
  },
];

test.describe("spec 0006: accessibility (axe)", () => {
  test("AC-12: every allow-list entry names a page that is scanned, a reason, and nothing twice", () => {
    const names = TARGETS.map((t) => t.name);
    for (const entry of ALLOWED) {
      expect(names, `the allow-list names a page that is not scanned: ${entry.page}`).toContain(entry.page);
      expect(entry.reason.trim(), `${entry.rule} on ${entry.page} has no reason`).not.toBe("");
    }
    const keys = ALLOWED.map((a) => `${a.page}/${a.rule}/${a.width ?? "both"}`);
    expect(new Set(keys).size, "an allow-list entry is listed twice").toBe(keys.length);
  });

  for (const target of TARGETS) {
    test(`AC-11, AC-12: ${target.name} has no serious or critical violation that the allow-list does not name, at both widths`, async ({ page }) => {
      test.setTimeout(120_000);
      if (target.signedIn) {
        const email = await signInAsNewUser(page);
        target.seed?.(email);
      }
      const findings: Finding[] = [];
      for (const width of Object.keys(WIDTHS) as Width[]) {
        await page.setViewportSize(WIDTHS[width]);
        await target.open(page);
        findings.push(...(await scan(page, width, width === "phone" ? (target.skipAtPhone ?? []) : [])));
      }
      const { unlisted, stale, ungated } = judge(target.name, findings, ALLOWED);
      for (const f of ungated) test.info().annotations.push({ type: "not enforced", description: describeFindings([f])[0] });
      expect(describeFindings(unlisted), `serious or critical violations on ${target.name} that the allow-list does not name`).toEqual([]);
      expect(
        stale.map((a) => `${a.rule} on ${a.page}${a.width ? ` at ${a.width}` : ""}`),
        `allow-list entries that no longer fire: delete them from e2e/accessibility-allowlist.ts`,
      ).toEqual([]);
    });
  }
});
