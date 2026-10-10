import { expect, test } from "@playwright/test";
import { signInAsNewUser } from "./helpers";

test.describe("spec 0001: extra stamps in stages", () => {
  test("AC-12, AC-13: every extra stamp that lies on a stage names it, in order along the trail", async ({ page }) => {
    await signInAsNewUser(page);
    const rows = page.locator("#extra-stamps li");
    expect(await rows.count()).toBeGreaterThan(50);
    const stages = await rows.evaluateAll((els) =>
      els.map((e) => Number(/· Stage (\d+)/.exec(e.textContent ?? "")?.[1] ?? 0)),
    );
    const labelled = stages.filter((n) => n > 0);
    expect(labelled.length).toBeGreaterThan(40);
    for (const n of labelled) expect(n).toBeGreaterThanOrEqual(1);
    for (const n of labelled) expect(n).toBeLessThanOrEqual(27);
    expect(labelled).toEqual([...labelled].sort((a, b) => a - b));
    expect(stages[0]).toBe(1);
  });

  test("AC-14: a stage's 'go to extra stamps (N)' counts exactly its extra stamps, and jumps to them", async ({ page }) => {
    await signInAsNewUser(page);
    const stage1 = page.locator("#stage-1");
    const link = stage1.getByRole("link", { name: /^go to extra stamps \(\d+\)$/ });
    await expect(link).toBeVisible();
    const count = Number(/\((\d+)\)/.exec((await link.textContent()) ?? "")![1]);

    const inStage1 = page.locator("#extra-stamps li").filter({ hasText: /· Stage 1(?!\d)/ });
    await expect(inStage1).toHaveCount(count);

    const firstId = (await inStage1.first().getAttribute("id"))!.replace("extra-", "");
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#extra-${firstId}$`));
    await expect(inStage1.first()).toBeInViewport();
  });

  test("AC-14: stages without extra stamps have no such link, and the links add up to the labelled stamps", async ({ page }) => {
    await signInAsNewUser(page);
    const links = page.getByRole("link", { name: /^go to extra stamps \(\d+\)$/ });
    const counts = (await links.allTextContents()).map((text) => Number(/\((\d+)\)/.exec(text)![1]));
    expect(counts.length).toBeGreaterThan(5);
    expect(counts.length).toBeLessThan(27);
    const labelled = await page
      .locator("#extra-stamps li")
      .evaluateAll((els) => els.filter((e) => /· Stage \d+/.test(e.textContent ?? "")).length);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(labelled);
  });
});
