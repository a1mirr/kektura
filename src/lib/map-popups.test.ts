// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { buildMenu, buildRestaurantPopup } from "./map-popups";

const evil = '<img src=x onerror="alert(1)">';

describe("spec 0003: popup DOM builders (AC-12, AC-14, AC-15)", () => {
  it("AC-17: a menu has the title, the subtitle and one button per action, in order", () => {
    const box = buildMenu("Írott-kő", "0.0 km from Írott-kő", [
      { label: "Route from here", run: () => {} },
      { label: "Show in list", run: () => {} },
    ]);
    expect(box.querySelector("strong")?.textContent).toBe("Írott-kő");
    expect(box.textContent).toContain("0.0 km from Írott-kő");
    expect([...box.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Route from here", "Show in list"]);
  });

  it("AC-17: a menu without a subtitle has none", () => {
    const box = buildMenu("Name", null, []);
    expect(box.children).toHaveLength(2); // title + the hidden error line
  });

  it("AC-17: clicking a button runs its action with that button; the error line starts hidden and is shown on request", () => {
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

  it("AC-15, AC-17: titles, subtitles and labels are text, never markup", () => {
    const box = buildMenu(evil, evil, [{ label: evil, run: () => {} }]);
    expect(box.querySelector("img")).toBeNull();
    expect(box.querySelector("strong")?.textContent).toBe(evil);
    expect(box.querySelector("button")?.textContent).toBe(evil);
  });

  it("AC-17: a restaurant popup shows name (city), the distance and a safe link to its page", () => {
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

  it("AC-15, AC-17: only https: URLs become links; markup in names stays text", () => {
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

describe("spec 0003: the note and the report link of a stamp's popup", () => {
  const link = { label: "Report a wrong location", href: "/en/feedback?stamp=OKTPH_84_B" };

  it("AC-26: a note is a paragraph of its own under the subtitle, as text", () => {
    const box = buildMenu("Lokó-pihenő", "679.5 km", [{ label: "Go", run: () => {} }], { note: `Moved on 30 September 2026. ${evil}` });
    const note = box.querySelector<HTMLElement>("[data-moved-note]")!;
    expect(note.textContent).toBe(`Moved on 30 September 2026. ${evil}`);
    expect(note.querySelector("img")).toBeNull(); // text, never markup (AC-15)
    expect([...box.children].indexOf(note)).toBeLessThan([...box.children].indexOf(box.querySelector("button")!));
  });

  it("AC-26: no note, no paragraph", () => {
    expect(buildMenu("Name", null, [], { note: undefined }).querySelector("[data-moved-note]")).toBeNull();
    expect(buildMenu("Name", null, [], { note: null }).querySelector("[data-moved-note]")).toBeNull();
  });

  it("AC-27: the report link opens in a new tab and is at least 44 x 44 px", () => {
    const box = buildMenu("Name", null, [], { link });
    const a = box.querySelector<HTMLAnchorElement>("a[data-report-link]")!;
    expect(a.textContent).toBe("Report a wrong location");
    expect(a.getAttribute("href")).toBe("/en/feedback?stamp=OKTPH_84_B");
    expect(a.target).toBe("_blank");
    expect(a.rel).toBe("noopener noreferrer");
    expect(a.style.minHeight).toBe("44px");
    expect(a.style.minWidth).toBe("44px");
    expect(a.style.display).toBe("flex"); // the whole row is the target, not the words
  });

  it("AC-27: only a path of this site or an https: address becomes a link", () => {
    for (const href of ["javascript:alert(1)", "//evil.example/", "http://x.example/", "data:text/html,x"]) {
      expect(buildMenu("Name", null, [], { link: { label: "x", href } }).querySelector("a")).toBeNull();
    }
    expect(buildMenu("Name", null, [], { link: { label: "x", href: "https://www.kektura.hu/" } }).querySelector("a")).not.toBeNull();
  });

  it("AC-27: the link comes after the buttons and before the error line", () => {
    const box = buildMenu("Name", null, [{ label: "Go", run: () => {} }], { link });
    const order = [...box.children].map((c) => c.tagName + (c.getAttribute("role") ?? ""));
    expect(order).toEqual(["STRONG", "BUTTON", "A", "DIValert"]);
  });
});
