import { expect, test } from "@playwright/test";
import { signInAsNewUser } from "./helpers";

// Spec 0013: extra stamps are linked to the stage they lie in. The numbers aren't hard-coded: the page
// has to agree with itself (what the stages say they link to is what the extra stamps say they are).
test.describe("spec 0013: extra stamps in stages", () => {
  test("AC-1, AC-2: every extra stamp that lies on a stage names it, in order along the trail", async ({ page }) => {
    await signInAsNewUser(page);
    const rows = page.locator("#extra-stamps li");
    expect(await rows.count()).toBeGreaterThan(50); // the 72 extra stamps
    const stages = await rows.evaluateAll((els) =>
      els.map((e) => Number(/· Stage (\d+)/.exec(e.textContent ?? "")?.[1] ?? 0)),
    );
    const labelled = stages.filter((n) => n > 0);
    expect(labelled.length).toBeGreaterThan(40);
    for (const n of labelled) expect(n).toBeGreaterThanOrEqual(1);
    for (const n of labelled) expect(n).toBeLessThanOrEqual(27);
    // The list is in km order, so stage numbers can only stay or grow.
    expect(labelled).toEqual([...labelled].sort((a, b) => a - b));
    // The first extra stamps (Velem, 3.8 km) lie between the first two places: stage 1.
    expect(stages[0]).toBe(1);
  });

  test("AC-3: a stage's 'go to extra stamps (N)' counts exactly its extra stamps, and jumps to them", async ({ page }) => {
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

  test("AC-3: stages without extra stamps have no such link, and the links add up to the labelled stamps", async ({ page }) => {
    await signInAsNewUser(page);
    const links = page.getByRole("link", { name: /^go to extra stamps \(\d+\)$/ });
    const counts = (await links.allTextContents()).map((text) => Number(/\((\d+)\)/.exec(text)![1]));
    expect(counts.length).toBeGreaterThan(5);
    expect(counts.length).toBeLessThan(27); // not every stage has extras
    const labelled = await page
      .locator("#extra-stamps li")
      .evaluateAll((els) => els.filter((e) => /· Stage \d+/.test(e.textContent ?? "")).length);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(labelled);
  });
});
