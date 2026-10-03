// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import StampDescriptions from "./StampDescriptions";

afterEach(cleanup);

const long =
  "Gyermekvasút - A peronlépcső forgalmi iroda melletti szélső oszlopán. (OKTPH_68_2) Gyermekvasút - A peron, az épület külső falán.";

describe("spec 0001: stamp descriptions", () => {
  it("AC-10: every description is rendered in full, one block each", () => {
    render(<StampDescriptions descriptions={["Short one.", long]} />);
    expect(screen.getByText("Short one.")).toBeTruthy();
    expect(screen.getByText(long).textContent).toBe(long);
  });

  it("AC-10: a description wraps instead of being truncated", () => {
    render(<StampDescriptions descriptions={[long]} />);
    const cls = screen.getByText(long).classList;
    expect(cls.contains("break-words")).toBe(true);
    for (const c of ["truncate", "text-ellipsis", "whitespace-nowrap", "overflow-hidden"]) {
      expect(cls.contains(c)).toBe(false);
    }
  });

  it("AC-10: a stamp without a description renders an empty block, not 'null'", () => {
    const { container } = render(<StampDescriptions descriptions={[null]} />);
    expect(container.textContent).toBe("");
  });
});
