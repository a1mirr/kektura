import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import en from "../messages/en.json";
import { CHANGELOG } from "../src/content/changelog";
import { routing } from "../src/i18n/routing";
import { signInAsNewUser } from "./helpers";

// The one test per behaviour that runs over every language (task 0068): the expected texts are read from the
// language's own messages file, so a new language needs no edit here. Other specs use the default language and
// at most one other.
type Messages = typeof en; // every language has the keys of English (spec 0005 AC-5)
const messages = (locale: string): Messages =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", `${locale}.json`), "utf8"));
const longDate = (locale: string, date: string) =>
  new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

test.describe("spec 0005: every language", () => {
  for (const locale of routing.locales) {
    const m = messages(locale);

    test(`AC-10, AC-11, 0014 AC-1, 0015 AC-1, AC-7, 0018 AC-3, 0019 AC-2: the public pages are in ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("combobox", { name: m.app.language })).toHaveValue(locale); // the dropdown (AC-10)
      await expect(page.getByRole("contentinfo").getByRole("link")).toHaveText([
        m.footer.about,
        m.footer.changelog,
        m.footer.usefulLinks,
        m.footer.feedback,
      ]);

      await page.goto(`/${locale}/about`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(m.about.title);
      await expect(page.getByRole("heading", { level: 2 })).toHaveCount(5);

      await page.goto(`/${locale}/changelog`);
      const newest = CHANGELOG[0];
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(m.changelog.title);
      await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText(newest.title[locale]);
      await expect(page.locator("time").first()).toHaveText(longDate(locale, newest.date));
      await expect(page.getByText(m.changelog.kind.fixed, { exact: true }).first()).toBeVisible();

      await page.goto(`/${locale}/links`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(m.links.title);
      await expect(page.getByRole("heading", { level: 2 })).toHaveText([m.links.groups.trail, m.links.groups.planning, m.links.groups.community]);
      await expect(page.getByText(m.links.items.kekturaHu)).toBeVisible();
    });

    test(`AC-10, 0015 AC-1, 0018 AC-1, 0019 AC-1: the public pages fit a phone screen in ${locale}, without sideways scrolling`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      for (const route of ["", "/about", "/changelog", "/links", "/feedback"]) {
        await page.goto(`/${locale}${route}`);
        const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(extra, `${locale}${route}`).toBeLessThanOrEqual(0);
      }
    });

    test(`0014 AC-15, AC-16, AC-18: the account link, page and sign-out button are in ${locale}, and the old /settings address keeps the language`, async ({ page }) => {
      await signInAsNewUser(page);
      await page.goto(`/${locale}/settings`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/account$`));
      await page.goto(`/${locale}/dashboard`);
      await page.getByRole("link", { name: m.dashboard.account, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/account$`));
      await expect(page).toHaveTitle(m.account.title);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(m.account.title);
      await page.getByRole("button", { name: m.account.signOut }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}$`));
    });
  }
});
