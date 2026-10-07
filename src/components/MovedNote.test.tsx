// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import MovedNote from "./MovedNote";

afterEach(cleanup);

describe("spec 0001: the note on the row of a stamp that moved", () => {
  it("AC-29: shows the note it is given as text, in words, marked for tests and for the page", () => {
    render(<MovedNote>{"Moved on September 30, 2026. Where it is now: by the lookout"}</MovedNote>);
    const note = screen.getByText("Moved on September 30, 2026. Where it is now: by the lookout");
    expect(note.hasAttribute("data-moved-note")).toBe(true);
    expect(note.tagName).toBe("P");
  });

  it("AC-29: markup in the data is text, never markup", () => {
    const evil = '<img src=x onerror="alert(1)">';
    const { container } = render(<MovedNote>{`Moved on today. ${evil}`}</MovedNote>);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain(evil);
  });

  it("AC-29: a long description wraps under the name instead of widening the row", () => {
    const { container } = render(<MovedNote>{"x".repeat(300)}</MovedNote>);
    expect(container.querySelector("p")!.className).toContain("[overflow-wrap:anywhere]");
  });
});
