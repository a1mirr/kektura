// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import { SCREENSHOT_SIZE, SCREENSHOTS } from "@/lib/screenshots";
import de from "../../messages/de.json";
import en from "../../messages/en.json";
import hu from "../../messages/hu.json";
import ru from "../../messages/ru.json";
import Screenshots from "./Screenshots";

afterEach(cleanup);

const messageFiles = { de, en, hu, ru };
type Gallery = { heading: string; note: string; [key: string]: string };
const galleryOf = (locale: keyof typeof messageFiles) => (messageFiles[locale].home.screenshots as Gallery);

function renderGallery(locale: keyof typeof messageFiles) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messageFiles[locale]}>
      <Screenshots />
    </NextIntlClientProvider>,
  );
}

describe.each(Object.keys(messageFiles) as (keyof typeof messageFiles)[])("spec 0038: the gallery in %s", (locale) => {
  const text = galleryOf(locale);

  it("AC-1: is a section with its own heading and the note, over three figures in the order dashboard, map, route planner", () => {
    renderGallery(locale);
    const section = screen.getByRole("region", { name: text.heading });
    expect(within(section).getByRole("heading", { level: 2 }).textContent).toBe(text.heading);
    expect(within(section).getByText(text.note)).toBeTruthy();
    const figures = within(section).getAllByRole("figure");
    expect(figures).toHaveLength(SCREENSHOTS.length);
    expect(figures.map((figure) => figure.querySelector("img")!.getAttribute("alt"))).toEqual(SCREENSHOTS.map((name) => text[`${name}Alt`]));
    expect(figures.map((figure) => figure.querySelector("figcaption")!.textContent)).toEqual(SCREENSHOTS.map((name) => text[`${name}Caption`]));
  });

  it("AC-2: every picture has an alternative text and a visible caption in the visitor's language, and they are not the same words", () => {
    renderGallery(locale);
    for (const figure of screen.getAllByRole("figure")) {
      const alt = figure.querySelector("img")!.getAttribute("alt")!;
      const caption = figure.querySelector("figcaption")!.textContent!;
      expect(alt.length).toBeGreaterThan(20);
      expect(caption.length).toBeGreaterThan(10);
      expect(alt).not.toBe(caption);
    }
  });

  it("AC-4: every picture says its size, loads lazily and is served by next/image at the size shown", () => {
    renderGallery(locale);
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(SCREENSHOTS.length);
    images.forEach((image, i) => {
      expect(image.getAttribute("width")).toBe(String(SCREENSHOT_SIZE.width));
      expect(image.getAttribute("height")).toBe(String(SCREENSHOT_SIZE.height));
      expect(image.getAttribute("loading")).toBe("lazy");
      expect(image.getAttribute("src")).toMatch(new RegExp(`^/_next/image\\?url=${encodeURIComponent(`/screenshots/${SCREENSHOTS[i]}.png`)}&w=\\d+&q=\\d+$`));
      expect(image.getAttribute("srcset")).toMatch(/ \d+w,/); // a width per size: the browser takes the one it needs
      expect(image.getAttribute("sizes")).toContain("304px");
    });
  });
});
