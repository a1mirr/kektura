import { expect, test } from "@playwright/test";
import { expandAllStages, signInAsNewUser, stat } from "./helpers";

const place = (page: import("@playwright/test").Page, key: string) => page.locator(`#place-${key}`);

test.describe("spec 0001 + 0002: stamping on the dashboard", () => {
  test("0002 AC-3, AC-4 + 0001 AC-3, AC-4: neighbouring stamps walk the stretch between them, persist, and can be removed", async ({
    page,
  }) => {
    await signInAsNewUser(page);
    await expandAllStages(page);

    await place(page, "OKTPH_01_DDKPH_01").getByRole("button", { name: "Add stamp" }).click(); // Írott-kő
    await expect(stat(page, "Stamps")).toHaveText("1 / 161");
    await expect(stat(page, "Kilometres")).toHaveText("0"); // one place alone walks nothing

    await place(page, "OKTPH_02").getByRole("button", { name: "Add stamp" }).click(); // Hét-forrás, km 8.1
    await expect(stat(page, "Stamps")).toHaveText("2 / 161");
    await expect(stat(page, "Kilometres")).toHaveText("8.1");

    await page.reload();
    await expect(stat(page, "Kilometres")).toHaveText("8.1");

    await expandAllStages(page);
    await place(page, "OKTPH_02").getByRole("button", { name: "Remove" }).click();
    await expect(stat(page, "Stamps")).toHaveText("1 / 161");
    await expect(stat(page, "Kilometres")).toHaveText("0");
  });

  test("0001 AC-7: stamping a stage includes its starting point; clearing it keeps the start", async ({ page }) => {
    await signInAsNewUser(page);
    await expandAllStages(page);
    const stage2 = page.locator("#stage-2"); // Sárvár -> Sümeg: 9 own places, starts at Sárvár (1.9)

    await stage2.getByRole("button", { name: "Stamp stage" }).click();
    await expect(stat(page, "Stamps")).toHaveText("10 / 161");
    await expect(stat(page, "Kilometres")).toHaveText("72.4");
    await expect(stage2.locator("[aria-expanded]")).toContainText("9/9");

    await stage2.getByRole("button", { name: "Clear stage" }).click();
    await expect(stat(page, "Stamps")).toHaveText("1 / 161");
    await expect(place(page, "OKTPH_09").getByRole("button", { name: "Remove" })).toBeVisible(); // Sárvár stays
  });

  test("0001 AC-10: stamp descriptions wrap in full: nothing is clipped or sticks out of its row at 375 px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await signInAsNewUser(page);
    await expandAllStages(page);

    const rows = await page.locator("li[id^=place-], #extra-stamps li").evaluateAll((lis) =>
      lis.flatMap((li) =>
        [...li.querySelectorAll<HTMLElement>("div.text-xs")].map((d) => {
          const s = getComputedStyle(d);
          return {
            id: li.id,
            clipped:
              s.textOverflow === "ellipsis" ||
              s.whiteSpace === "nowrap" ||
              d.scrollWidth > d.clientWidth ||
              d.getBoundingClientRect().right > li.getBoundingClientRect().right,
          };
        }),
      ),
    );
    expect(rows.length).toBeGreaterThan(200); // 161 places (220 stamps) + 72 extra stamps
    expect(rows.filter((r) => r.clipped).map((r) => r.id)).toEqual([]);
  });
});
