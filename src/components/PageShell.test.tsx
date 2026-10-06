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

  it("spec 0001 AC-28: only a sticky aside sticks", () => {
    const { rerender } = render(
      <PageShell aside={<p>side</p>}>
        <p>list</p>
      </PageShell>,
    );
    expect(screen.getByText("side").parentElement!.className).not.toContain("sticky");
    rerender(
      <PageShell sticky aside={<p>side</p>}>
        <p>list</p>
      </PageShell>,
    );
    expect(screen.getByText("side").parentElement!.className).toContain("lg:sticky");
    // a sticky box is a stacking context: it needs a z-index of its own, or the fullscreen map inside it (z-50, local to it)
    // is painted under positioned controls of the other column (spec 0003 AC-11)
    expect(screen.getByText("side").parentElement!.className).toContain("lg:z-10");
  });
});
