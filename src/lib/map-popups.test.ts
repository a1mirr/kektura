// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { buildMenu, buildRestaurantPopup } from "./map-popups";

const evil = '<img src=x onerror="alert(1)">';

describe("spec 0011: popup DOM builders (spec 0003 AC-12, AC-14, AC-15)", () => {
  it("AC-4: a menu has the title, the subtitle and one button per action, in order", () => {
    const box = buildMenu("Írott-kő", "0.0 km from Írott-kő", [
      { label: "Route from here", run: () => {} },
      { label: "Show in list", run: () => {} },
    ]);
    expect(box.querySelector("strong")?.textContent).toBe("Írott-kő");
    expect(box.textContent).toContain("0.0 km from Írott-kő");
    expect([...box.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Route from here", "Show in list"]);
  });

  it("AC-4: a menu without a subtitle has none", () => {
    const box = buildMenu("Name", null, []);
    expect(box.children).toHaveLength(2); // title + the hidden error line
  });

  it("AC-4: clicking a button runs its action with that button; the error line starts hidden and is shown on request", () => {
    const run = vi.fn();
    const box = buildMenu("Name", null, [{ label: "Go", run }]);
    const error = box.querySelector<HTMLElement>('[role="alert"]')!;
    expect(error.hidden).toBe(true);

    box.querySelector("button")!.click();
    expect(run).toHaveBeenCalledTimes(1);
    const [button, showError] = run.mock.calls[0];
    expect(button).toBe(box.querySelector("button"));

    showError("Couldn't save, try again.");
    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe("Couldn't save, try again.");

    box.querySelector("button")!.click(); // the next attempt clears the old error
    expect(error.hidden).toBe(true);
  });

  it("AC-4 + 0003 AC-15: titles, subtitles and labels are text, never markup", () => {
    const box = buildMenu(evil, evil, [{ label: evil, run: () => {} }]);
    expect(box.querySelector("img")).toBeNull();
    expect(box.querySelector("strong")?.textContent).toBe(evil);
    expect(box.querySelector("button")?.textContent).toBe(evil);
  });

  it("AC-4: a restaurant popup shows name (city), the distance and a safe link to its page", () => {
    const box = buildRestaurantPopup({
      name: "Étterem",
      city: "Sopron",
      url: "https://etteremhet.hu/x",
      distance: "1.5 km from the trail as the crow flies",
      linkLabel: "Open on etteremhet.hu",
    });
    expect(box.querySelector("strong")?.textContent).toBe("Étterem (Sopron)");
    expect(box.textContent).toContain("1.5 km from the trail");
    const link = box.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("https://etteremhet.hu/x");
    expect(link.textContent).toBe("Open on etteremhet.hu");
    expect(link.target).toBe("_blank");
    expect(link.rel).toBe("noopener noreferrer");
  });

  it("AC-4 + 0003 AC-15: only https: URLs become links; markup in names stays text", () => {
    for (const url of ["javascript:alert(1)", "http://insecure.example/", "data:text/html,x", ""]) {
      const box = buildRestaurantPopup({
        name: "N",
        city: "C",
        url,
        distance: "d",
        linkLabel: "l",
      });
      expect(box.querySelector("a")!.hasAttribute("href")).toBe(false);
    }
    const box = buildRestaurantPopup({
      name: evil,
      city: evil,
      url: "https://a.hu/",
      distance: evil,
      linkLabel: evil,
    });
    expect(box.querySelector("img")).toBeNull();
  });
});
