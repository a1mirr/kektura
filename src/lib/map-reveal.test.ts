// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STAGE_EVENT, type StageEventDetail } from "./stage-events";
import { revealInList } from "./map-reveal";

let scrollIntoView: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("spec 0011: revealing a list row (spec 0003 AC-12)", () => {
  it("AC-4: a visible row is scrolled to the centre and flashed on the next tick, without opening any stage", () => {
    document.body.innerHTML = '<li id="place-A">A</li>';
    const opened = vi.fn();
    window.addEventListener(STAGE_EVENT, opened);

    revealInList("place", "A");
    expect(scrollIntoView).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
    expect(document.getElementById("place-A")!.classList.contains("flash")).toBe(true);
    expect(opened).not.toHaveBeenCalled();
    window.removeEventListener(STAGE_EVENT, opened);
  });

  it("AC-4: a row in a collapsed stage opens that stage first and scrolls once it has laid out", () => {
    document.body.innerHTML = '<li id="extra-7" data-stage="3">X</li>';
    const events: StageEventDetail[] = [];
    const listener = (e: Event) => events.push((e as CustomEvent<StageEventDetail>).detail);
    window.addEventListener(STAGE_EVENT, listener);

    revealInList("extra", "7");
    expect(events).toEqual([{ stage: 3, open: true }]);
    vi.advanceTimersByTime(79);
    expect(scrollIntoView).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    window.removeEventListener(STAGE_EVENT, listener);
  });

  it("AC-4: flashing again restarts the animation by removing and re-adding the class", () => {
    document.body.innerHTML = '<li id="place-A" class="flash">A</li>';
    const el = document.getElementById("place-A")!;
    const classes: boolean[] = [];
    const remove = el.classList.remove.bind(el.classList);
    el.classList.remove = (...tokens: string[]) => {
      remove(...tokens);
      classes.push(el.classList.contains("flash"));
    };

    revealInList("place", "A");
    vi.advanceTimersByTime(0);

    expect(classes).toEqual([false]);
    expect(el.classList.contains("flash")).toBe(true);
  });

  it("AC-4: an unknown row does nothing", () => {
    expect(() => revealInList("place", "missing")).not.toThrow();
    vi.advanceTimersByTime(500);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
