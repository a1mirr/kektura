// @vitest-environment jsdom
// Spec 0036 AC-2 to AC-4 and the blocks of spec 0001 AC-28: what each variant of the shell renders.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PageShell, { pageWidth } from "./PageShell";

afterEach(cleanup);

describe("spec 0036: PageShell", () => {
  it("AC-2: every variant is one <main> with the shared width and padding", () => {
    for (const variant of ["wide", "reading", "hero", "card"] as const) {
      const { unmount } = render(<PageShell variant={variant}>x</PageShell>);
      const main = screen.getByRole("main");
      expect(main.className, variant).toContain(pageWidth);
      expect(main.className, variant).toContain("max-w-(--page-width)");
      unmount();
    }
  });

  it("AC-3: a reading page keeps its text in a column of about 65 characters, centred", () => {
    render(<PageShell variant="reading">text</PageShell>);
    const column = screen.getByText("text");
    expect(column.className).toContain("max-w-prose");
    expect(column.className).toContain("mx-auto");
  });

  it("AC-4: a hero page fills the space above the footer with flex-1, never min-h-screen", () => {
    render(<PageShell variant="hero">hello</PageShell>);
    expect(screen.getByRole("main").className).toContain("flex-1");
    expect(screen.getByRole("main").className).not.toContain("min-h-screen");
  });

  it("AC-4, AC-6: a hero page with content below keeps its block narrow and puts the content after it at the full width, top-aligned", () => {
    render(
      <PageShell variant="hero" below={<p>gallery</p>}>
        <p>hello</p>
      </PageShell>,
    );
    const main = screen.getByRole("main");
    const [block, below] = Array.from(main.children);
    expect(block.className).toContain("max-w-2xl");
    expect(block.textContent).toBe("hello");
    expect(below.textContent).toBe("gallery");
    expect(below.className).not.toContain("max-w-2xl"); // the content's own width, not the block's
    expect(main.className).not.toContain("justify-center"); // taller than a screen: it starts at the top
    expect(main.className).not.toContain("min-h-screen");
  });

  it("AC-4: a card page draws one narrow centred card", () => {
    render(<PageShell variant="card">invite</PageShell>);
    const card = screen.getByText("invite");
    expect(card.className).toContain("max-w-md");
    expect(card.className).toContain("rounded-xl");
  });

  it("spec 0001 AC-28: a split page keeps header, aside and children in this order, side by side from 1024 px", () => {
    render(
      <PageShell header={<header>head</header>} aside={<p>side</p>}>
        <p>list</p>
      </PageShell>,
    );
    const text = screen.getByRole("main").textContent;
    expect(text).toBe("headsidelist");
    expect(screen.getByText("head").parentElement).toBe(screen.getByRole("main")); // `main > header` stays a direct child
    const grid = screen.getByText("side").parentElement!.parentElement!;
    expect(grid.className).toContain("lg:grid");
    expect(grid.className).toContain("lg:grid-cols-");
  });

  it("spec 0001 AC-28: the aside is as tall as the children only when it is asked to stretch, so a block in it can stick", () => {
    const { rerender } = render(
      <PageShell aside={<p>side</p>}>
        <p>list</p>
      </PageShell>,
    );
    const grid = () => screen.getByText("side").parentElement!.parentElement!;
    expect(grid().className).toContain("lg:items-start");
    rerender(
      <PageShell stretch aside={<p>side</p>}>
        <p>list</p>
      </PageShell>,
    );
    expect(grid().className).not.toContain("lg:items-start");
  });
});
