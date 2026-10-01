// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { setStageOpen } from "@/lib/stage-events";
import StageSection from "./StageSection";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderStage(stage = 3) {
  render(
    <StageSection stage={stage} title={`Stage ${stage}`} route="A → B" kmText="10 km" done={1} total={2} actions={null}>
      <li id="place-X">X</li>
    </StageSection>,
  );
  return {
    toggle: screen.getByRole("button", { expanded: false }),
    list: () => document.getElementById("place-X")!.parentElement!,
  };
}

const isOpen = (list: HTMLElement) => !list.classList.contains("hidden");

describe("spec 0001: collapsible stages", () => {
  it("AC-8: stages start collapsed, with rows still in the DOM for map clicks", () => {
    const { list } = renderStage();
    expect(document.getElementById("place-X")).not.toBeNull();
    expect(isOpen(list())).toBe(false);
  });

  it("AC-8: the header toggles the stage and remembers the choice", () => {
    const { toggle, list } = renderStage();
    fireEvent.click(toggle);
    expect(isOpen(list())).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(localStorage.getItem("kektura:stage:3")).toBe("1");
  });

  it("AC-8: a remembered open stage reopens after mount", async () => {
    localStorage.setItem("kektura:stage:3", "1");
    const { list } = renderStage();
    await waitFor(() => expect(isOpen(list())).toBe(true));
  });

  it("AC-9: stage events open one stage (map click) or all of them (expand/collapse all)", () => {
    const { list } = renderStage(3);
    act(() => setStageOpen(4, true));
    expect(isOpen(list())).toBe(false);
    act(() => setStageOpen(3, true));
    expect(isOpen(list())).toBe(true);
    act(() => setStageOpen("all", false));
    expect(isOpen(list())).toBe(false);
  });
});
