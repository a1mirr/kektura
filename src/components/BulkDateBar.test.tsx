// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../../messages/en.json";
import { extraItemId, placeItemId, type BulkItem } from "@/lib/bulk-dates";

const refresh = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh }) }));
type Answer = { ok: true } | { ok: false; reason: "unauthorized" | "failed" };
const setStampDates = vi.fn(async (...args: unknown[]): Promise<Answer> => {
  void args;
  return { ok: true };
});
vi.mock("@/app/[locale]/dashboard/actions", () => ({
  setStampDates: (...args: unknown[]) => setStampDates(...args),
}));

import BulkCheckbox from "./BulkCheckbox";
import { BulkMessage, BulkToolbar } from "./BulkDateBar";
import BulkDatesProvider from "./BulkDatesProvider";
import BulkStageButton from "./BulkStageButton";
import RequiredFrom from "./RequiredFrom";
import StageControls from "./StageControls";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  setStampDates.mockImplementation(async () => ({ ok: true }));
});

const place = (key: string, stage: number, retiredOn?: string, stamped = true): BulkItem => ({
  id: placeItemId(key),
  kind: "place",
  placeKey: key,
  stage,
  name: `Place ${key}`,
  stamped,
  ...(retiredOn ? { retiredOn } : {}),
});
const extra = (id: number, stamped = true): BulkItem => ({ id: extraItemId(id), kind: "extra", extraId: id, name: `Extra ${id}`, stamped });

// Four stamped places in two stages, a place U that is not stamped yet, an extra stamp and an extra stamp that is not stamped yet.
const ITEMS: BulkItem[] = [place("A", 1), place("B", 1), place("U", 1, undefined, false), place("C", 1), place("D", 2), extra(7), extra(8, false)];

function Page({ items = ITEMS, rows = items }: { items?: BulkItem[]; rows?: BulkItem[] }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <BulkDatesProvider items={items} max="2999-01-01">
        <BulkMessage />
        <BulkToolbar>
          <StageControls />
        </BulkToolbar>
        <BulkStageButton stage={1} />
        <BulkStageButton stage={2} />
        <BulkStageButton stage={3} />
        <ul>
          {rows.map((r) => (
            <li key={r.id}>
              <BulkCheckbox id={r.id} name={r.name} />
              {r.name}
            </li>
          ))}
        </ul>
      </BulkDatesProvider>
    </NextIntlClientProvider>
  );
}

const BAR = "Set the date of several stamps";
const bar = () => screen.getByRole("region", { name: BAR });
const noBar = () => screen.queryByRole("region", { name: BAR });
const modeButton = () => screen.getByRole("button", { name: "Set dates" });
const noModeButton = () => screen.queryByRole("button", { name: "Set dates" });
const box = (name: string) => screen.getByRole("checkbox", { name: `Select ${name}` });
const chosen = () =>
  screen
    .queryAllByRole("checkbox")
    .filter((c) => (c as HTMLInputElement).checked)
    .map((c) => c.getAttribute("aria-label")!.replace("Select ", ""));
const field = () => screen.getByLabelText("New date of the selected stamps") as HTMLInputElement;
const apply = () => screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement;
const type = (value: string) => act(() => void fireEvent.change(field(), { target: { value } }));
const enter = () => act(() => void fireEvent.click(modeButton()));
const click = (el: HTMLElement, init?: { shiftKey: boolean }) => act(() => void fireEvent.click(el, init));
const choose = (...names: string[]) => names.forEach((n) => click(box(n)));
const submit = () => act(async () => void fireEvent.submit(field().closest("form")!));

describe("spec 0016: the mode", () => {
  it("AC-14: outside the mode no row has a checkbox and there is no bar, only the toolbar's button that opens the mode", () => {
    render(<Page />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(noBar()).toBeNull();
    expect(modeButton().getAttribute("aria-pressed")).toBe("false");
    enter();
    expect(bar()).toBeTruthy();
    expect(modeButton().getAttribute("aria-pressed")).toBe("true"); // still there: pressing it leaves the mode
  });

  it("AC-14: the toolbar sticks to the top, under the map's block from 1024 px, and holds the bar in the mode", () => {
    render(<Page />);
    const toolbar = modeButton().closest("[class*='sticky']") as HTMLElement;
    expect(toolbar.className.split(" ")).toEqual(expect.arrayContaining(["sticky", "top-0", "z-20", "lg:z-5"]));
    enter();
    expect(toolbar.contains(bar())).toBe(true);
    expect(toolbar.contains(modeButton())).toBe(true);
  });

  it("AC-14: the button is a filled button of at least 36 px on a phone, not a text link", () => {
    render(<Page />);
    expect(modeButton().className.split(" ")).toEqual(expect.arrayContaining(["bg-blue-600", "min-h-9", "text-white"]));
  });

  describe("on a phone the toolbar hides while the page scrolls down and comes back on the way up", () => {
    const scrollTo = (y: number) => act(() => void (Object.defineProperty(window, "scrollY", { value: y, configurable: true }), window.dispatchEvent(new Event("scroll"))));
    const hidden = () => modeButton().closest("[class*='sticky']")!.hasAttribute("data-hidden");
    afterEach(() => void Object.defineProperty(window, "scrollY", { value: 0, configurable: true }));

    it("AC-14: hides after scrolling down past the top, shows when scrolling up, ignores a nudge and the very top", () => {
      render(<Page />);
      scrollTo(60);
      expect(hidden()).toBe(false); // too near the top
      scrollTo(400);
      expect(hidden()).toBe(true);
      scrollTo(404);
      expect(hidden()).toBe(true); // a nudge changes nothing
      scrollTo(300);
      expect(hidden()).toBe(false);
    });

    it("AC-14: the toolbar is not hidden while the mode is open, and a focus inside it brings it back", () => {
      render(<Page />);
      scrollTo(500);
      expect(hidden()).toBe(true);
      act(() => void fireEvent.focus(modeButton()));
      expect(hidden()).toBe(false);
      scrollTo(900);
      expect(hidden()).toBe(true);
      enter();
      expect(hidden()).toBe(false);
    });
  });

  it("AC-14: in the mode every place and extra stamp has a checkbox named after it, stamped or not", () => {
    render(<Page />);
    enter();
    expect(screen.getAllByRole("checkbox").map((c) => c.getAttribute("aria-label"))).toEqual([
      "Select Place A",
      "Select Place B",
      "Select Place U",
      "Select Place C",
      "Select Place D",
      "Select Extra 7",
      "Select Extra 8",
    ]);
  });

  it("AC-14: a row the page does not hand over (an unstamped retired stamp) has no checkbox", () => {
    const old = { ...place("R", 1, "2014-11-21", false), name: "Old house" };
    render(<Page items={ITEMS} rows={[...ITEMS, old]} />);
    enter();
    expect(screen.queryByRole("checkbox", { name: "Select Old house" })).toBeNull();
    expect(screen.getAllByRole("checkbox")).toHaveLength(ITEMS.length);
  });

  it("AC-14: Cancel and Escape leave the mode and forget the choice; the button is back and has the focus", () => {
    render(<Page />);
    for (const leave of [
      () => click(screen.getByRole("button", { name: "Cancel" })),
      () => act(() => void fireEvent.keyDown(window, { key: "Escape" })),
    ]) {
      enter();
      choose("Place A");
      expect(chosen()).toEqual(["Place A"]);
      leave();
      expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
      expect(noBar()).toBeNull();
      expect(document.activeElement).toBe(modeButton());
      enter();
      expect(chosen()).toEqual([]); // not remembered
      click(screen.getByRole("button", { name: "Cancel" }));
    }
  });

  it("AC-14: opening the mode moves the focus into the bar", () => {
    render(<Page />);
    enter();
    expect(document.activeElement).toBe(bar());
  });

  it("AC-14: the server's HTML has neither the button, the bar, a checkbox nor a stage button: without JavaScript the mode is not offered", () => {
    const html = renderToString(<Page />);
    expect(html).not.toContain("Set dates");
    expect(html).not.toContain("Select stage");
    expect(html).not.toContain("checkbox");
    expect(html).toContain("Expand all"); // the rest of the controls are there
  });

  it("AC-14: a page without the provider (a friend's page) has no button", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <BulkMessage />
        <BulkToolbar>
          <StageControls />
        </BulkToolbar>
      </NextIntlClientProvider>,
    );
    expect(noModeButton()).toBeNull();
    expect(screen.getByRole("button", { name: "Expand all" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Expand all" }).closest("[class*='sticky']")).toBeNull(); // nothing sticks there
  });
});

describe("spec 0016: the bar above the on-screen keyboard", () => {
  // A stand-in for window.visualViewport: the part of the layout viewport the keyboard covers is innerHeight - height - offsetTop.
  function stubViewport(init: { height: number; offsetTop?: number; scale?: number }) {
    const viewport = Object.assign(new EventTarget(), { width: 375, height: init.height, offsetTop: init.offsetTop ?? 0, scale: init.scale ?? 1 });
    const add = vi.spyOn(viewport, "addEventListener");
    const remove = vi.spyOn(viewport, "removeEventListener");
    Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true });
    return { viewport, add, remove };
  }
  const gap = () => (bar().style.getPropertyValue("--kb") as string) || "";
  afterEach(() => Reflect.deleteProperty(window, "visualViewport"));

  it("AC-21: the bar's bottom follows the part of the screen the keyboard covers, and its listeners go with the bar", () => {
    const { viewport, add, remove } = stubViewport({ height: window.innerHeight }); // no keyboard
    render(<Page />);
    enter();
    expect(gap()).toBe("0px");
    viewport.height = window.innerHeight - 300; // the keyboard opens
    act(() => void viewport.dispatchEvent(new Event("resize")));
    expect(gap()).toBe("300px");
    viewport.offsetTop = 40; // the visual viewport scrolled inside the layout one
    act(() => void viewport.dispatchEvent(new Event("scroll")));
    expect(gap()).toBe("260px");
    viewport.height = window.innerHeight;
    viewport.offsetTop = 0;
    act(() => void viewport.dispatchEvent(new Event("resize"))); // the keyboard closes
    expect(gap()).toBe("0px");
    const listeners = add.mock.calls.map((c) => c[0]).sort();
    expect(listeners).toEqual(["resize", "scroll"]);
    click(screen.getByRole("button", { name: "Cancel" })); // the bar goes: so do its listeners
    expect(remove.mock.calls.map((c) => c[0]).sort()).toEqual(["resize", "scroll"]);
    expect(new Set(remove.mock.calls.map((c) => c[1]))).toEqual(new Set(add.mock.calls.map((c) => c[1]))); // the very functions that were added
  });

  it("AC-21: a pinch-zoomed page (scale above 1.01) gets no gap: the zoomed viewport is not a keyboard", () => {
    const { viewport } = stubViewport({ height: window.innerHeight - 300, scale: 2 });
    render(<Page />);
    enter();
    expect(gap()).toBe("0px");
    viewport.scale = 1;
    act(() => void viewport.dispatchEvent(new Event("resize")));
    expect(gap()).toBe("300px");
    viewport.scale = 1.5;
    act(() => void viewport.dispatchEvent(new Event("resize")));
    expect(gap()).toBe("0px");
  });

  it("AC-21: without a visual viewport (an old browser, jsdom) the bar still works with no gap", () => {
    render(<Page />);
    enter();
    expect(gap()).toBe("0px");
  });
});

describe("spec 0016: Escape", () => {
  it("AC-14: Escape that closes a row's open note leaves the mode and the choice alone; the next Escape leaves the mode", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <BulkDatesProvider items={ITEMS} max="2999-01-01">
          <BulkToolbar>
            <StageControls />
          </BulkToolbar>
          <RequiredFrom requiredFrom="2022-05-01" waived={false} tolerance={false} />
          <BulkCheckbox id={placeItemId("A")} name="Place A" />
        </BulkDatesProvider>
      </NextIntlClientProvider>,
    );
    enter();
    choose("Place A");
    const note = screen.getByRole("button", { name: /About this date/ });
    click(note);
    expect(note.getAttribute("aria-expanded")).toBe("true");
    act(() => void fireEvent.keyDown(note, { key: "Escape" }));
    expect(note.getAttribute("aria-expanded")).toBe("false"); // the note is closed...
    expect(bar()).toBeTruthy(); // ...and the mode and the choice are as they were
    expect(chosen()).toEqual(["Place A"]);
    act(() => void fireEvent.keyDown(note, { key: "Escape" })); // nothing open any more: Escape leaves the mode
    expect(noBar()).toBeNull();
  });
});

describe("spec 0016: choosing rows", () => {
  it("AC-15: a click chooses and unchooses one row, and the count is announced in a status region", () => {
    render(<Page />);
    enter();
    const status = () => within(bar()).getByRole("status").textContent;
    expect(status()).toBe("0 selected");
    choose("Place B", "Extra 7");
    expect(chosen()).toEqual(["Place B", "Extra 7"]);
    expect(status()).toBe("2 selected");
    choose("Place B");
    expect(status()).toBe("1 selected");
  });

  it("AC-16: the status also says how many of the chosen rows are not stamped yet, and nothing about it when all are", () => {
    render(<Page />);
    enter();
    const status = () => within(bar()).getByRole("status").textContent;
    choose("Place A", "Place U", "Extra 8");
    expect(status()).toBe("3 selected · 2 not stamped yet");
    choose("Place U", "Extra 8");
    expect(status()).toBe("1 selected");
  });

  it("AC-15: a shift-click chooses the range from the last chosen row, in the page's order, across the places and the extras", () => {
    render(<Page />);
    enter();
    choose("Place B");
    click(box("Extra 7"), { shiftKey: true });
    expect(chosen()).toEqual(["Place B", "Place U", "Place C", "Place D", "Extra 7"]); // also the place that is not stamped
    click(box("Place C"), { shiftKey: true }); // C is chosen: the range from the anchor (the extra) down to C is cleared
    expect(chosen()).toEqual(["Place B", "Place U"]);
  });

  it("AC-15: the bar's Select all chooses every row, stamped or not, Clear nothing and Clear does not leave the mode", () => {
    render(<Page />);
    enter();
    click(screen.getByRole("button", { name: "Select all" }));
    expect(chosen()).toHaveLength(ITEMS.length);
    click(screen.getByRole("button", { name: "Clear" }));
    expect(chosen()).toEqual([]);
    expect(bar()).toBeTruthy();
  });

  it("AC-15: in the mode a stage's button adds every place of that stage to the choice, stamped or not, and only those", () => {
    render(<Page />);
    enter();
    choose("Place D");
    click(screen.getByRole("button", { name: "Select stage: Stage 1" }));
    expect(chosen()).toEqual(["Place A", "Place B", "Place U", "Place C", "Place D"]);
    expect(screen.queryByRole("button", { name: /Stage 3/ })).toBeNull(); // nothing in stage 3: no button
    expect((box("Extra 7") as HTMLInputElement).checked).toBe(false); // the extras are not a stage's
  });

  it("AC-15: outside the mode a stage has no button: the way in is the toolbar's button (AC-14)", () => {
    render(<Page />);
    expect(screen.queryByRole("button", { name: /stage/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Set date:/ })).toBeNull();
    enter();
    expect(screen.getByRole("button", { name: "Select stage: Stage 2" })).toBeTruthy();
  });

  it("AC-15: a chosen row that disappears from the page (removed meanwhile) is no longer chosen or counted", () => {
    const view = render(<Page />);
    enter();
    choose("Place A", "Place B");
    view.rerender(<Page items={ITEMS.filter((i) => i.id !== placeItemId("A"))} />);
    expect(chosen()).toEqual(["Place B"]);
    expect(screen.getByText("1 selected")).toBeTruthy();
  });
});

describe("spec 0016: the bar", () => {
  it("AC-16: the date field is the yyyy-mm-dd text field with a calendar button limited to the valid range", () => {
    render(<Page />);
    enter();
    expect(field().type).toBe("text");
    expect(field().placeholder).toBe("yyyy-mm-dd");
    expect(field().maxLength).toBe(10);
    expect(within(bar()).getByRole("button", { name: "Open calendar" })).toBeTruthy();
    const picker = bar().querySelector("input[type=date]") as HTMLInputElement;
    expect(picker.min).toBe("1938-01-01");
    expect(picker.max).toBe("2999-01-01"); // what the page gives: tomorrow in UTC
  });

  it("AC-16: Apply is disabled for nothing chosen, and for an empty, incomplete, other-format, impossible or out-of-range date", () => {
    render(<Page />);
    enter();
    type("2026-09-15");
    expect(apply().disabled).toBe(true); // nothing chosen
    choose("Place A");
    type("");
    expect(apply().disabled).toBe(true);
    for (const bad of ["2026-09-1", "2026-9-15", "15/09/2026", "2026-02-30", "1937-12-31", "2999-01-01", "x"]) {
      type(bad);
      expect(apply().disabled, bad).toBe(true);
    }
    type("2026-09-15");
    expect(apply().disabled).toBe(false);
    choose("Place A"); // unchosen again
    expect(apply().disabled).toBe(true);
  });

  it("AC-16: nothing is sent while the date is typed, however long, or picked: only Apply sends", async () => {
    render(<Page />);
    enter();
    choose("Place A", "Extra 7");
    for (const part of ["2", "20", "2026-0", "2026-09-1", "2026-09-15"]) type(part);
    act(() => void fireEvent.blur(field()));
    act(() => void fireEvent.change(bar().querySelector("input[type=date]")!, { target: { value: "2026-09-16" } }));
    expect(field().value).toBe("2026-09-16"); // a pick fills the field
    expect(setStampDates).not.toHaveBeenCalled();
    await act(async () => void fireEvent.click(apply()));
    expect(setStampDates).toHaveBeenCalledOnce();
  });

  it("AC-17: Apply sends the chosen places and extra stamps, stamped or not, with the date, as one request", async () => {
    render(<Page />);
    enter();
    choose("Place A", "Place U", "Place D", "Extra 7", "Extra 8");
    type("2026-09-15");
    await act(async () => void fireEvent.click(apply()));
    expect(setStampDates).toHaveBeenCalledWith(["A", "U", "D"], [7, 8], "2026-09-15");
  });

  it("AC-16: Enter in the date field applies, and Enter with a date that cannot be applied sends nothing", async () => {
    render(<Page />);
    enter();
    choose("Place B");
    type("2026-9-15");
    await submit();
    expect(setStampDates).not.toHaveBeenCalled();
    type("2026-09-15");
    await submit();
    expect(setStampDates).toHaveBeenCalledWith(["B"], [], "2026-09-15");
  });

  it("AC-16: while saving the bar shows a pending state and a second press sends nothing", async () => {
    let finish!: (r: Answer) => void;
    setStampDates.mockImplementation(() => new Promise<Answer>((resolve) => (finish = resolve)));
    render(<Page />);
    enter();
    choose("Place A");
    type("2026-09-15");
    click(apply());
    const saving = screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement;
    expect(saving.disabled).toBe(true);
    click(saving);
    act(() => void fireEvent.submit(field().closest("form")!));
    expect(setStampDates).toHaveBeenCalledOnce();
    expect(bar().getAttribute("aria-busy")).toBe("true");
    act(() => void fireEvent.keyDown(window, { key: "Escape" })); // leaving now would hide the answer
    expect(bar()).toBeTruthy();
    await act(async () => finish({ ok: true }));
    await waitFor(() => expect(noBar()).toBeNull());
  });

  it("AC-19: after a save that went through the mode closes, the choice is gone and a message names how many dates were set", async () => {
    render(<Page />);
    enter();
    choose("Place A", "Place B", "Extra 7");
    type("2026-09-15");
    await act(async () => void fireEvent.click(apply()));
    await waitFor(() => expect(noBar()).toBeNull());
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.getByText("3 dates set").getAttribute("aria-live")).toBe("polite");
    enter(); // a new visit starts clean, without the old message
    expect(chosen()).toEqual([]);
    expect(screen.queryByText("3 dates set")).toBeNull();
  });

  it("AC-19: one date is '1 date set'", async () => {
    render(<Page />);
    enter();
    choose("Place A");
    type("2026-09-15");
    await act(async () => void fireEvent.click(apply()));
    await waitFor(() => expect(screen.getByText("1 date set")).toBeTruthy());
  });

  it("AC-19: after a failure the choice and the typed date stay, the usual message shows, and Apply works again", async () => {
    setStampDates.mockResolvedValueOnce({ ok: false, reason: "failed" });
    render(<Page />);
    enter();
    choose("Place A", "Place B");
    type("2026-09-15");
    await act(async () => void fireEvent.click(apply()));
    expect((await screen.findByRole("alert")).textContent).toBe("Couldn't save, try again.");
    expect(chosen()).toEqual(["Place A", "Place B"]);
    expect(field().value).toBe("2026-09-15");
    expect(apply().disabled).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => void fireEvent.click(apply()));
    expect(setStampDates).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(noBar()).toBeNull());
  });

  it("AC-19: a request that rejects (a network error) is a failure too, and an expired session refreshes the page", async () => {
    setStampDates.mockRejectedValueOnce(new Error("offline"));
    render(<Page />);
    enter();
    choose("Place A");
    type("2026-09-15");
    await act(async () => void fireEvent.click(apply()));
    expect((await screen.findByRole("alert")).textContent).toBe("Couldn't save, try again.");
    setStampDates.mockResolvedValueOnce({ ok: false, reason: "unauthorized" });
    await act(async () => void fireEvent.click(apply()));
    expect(refresh).toHaveBeenCalledOnce();
    expect(chosen()).toEqual(["Place A"]);
  });
});

describe("spec 0016: a retired stamp in the choice", () => {
  const old = { ...place("R", 1, "2014-11-21"), name: "Old house" };
  const rows = [place("A", 1), old];

  it("AC-18: the bar names the retired stamps the date cannot go to; Apply is disabled until the date is earlier or they are unchosen", async () => {
    render(<Page items={rows} rows={rows} />);
    enter();
    choose("Place A", "Old house");
    type("2026-09-15");
    expect(screen.getByText(/cannot get a date on or after the day it retired: Old house\./)).toBeTruthy();
    expect(apply().disabled).toBe(true);
    expect(field().getAttribute("aria-describedby")).toBe("bulk-conflict");
    type("2014-11-20"); // the day before it retired
    expect(screen.queryByText(/cannot get a date/)).toBeNull();
    expect(apply().disabled).toBe(false);
    type("2014-11-21");
    expect(apply().disabled).toBe(true);
    choose("Old house"); // taken out of the choice
    expect(screen.queryByText(/cannot get a date/)).toBeNull();
    expect(apply().disabled).toBe(false);
    await act(async () => void fireEvent.click(apply()));
    expect(setStampDates).toHaveBeenCalledWith(["A"], [], "2014-11-21");
  });

  it("AC-18: a retired stamp takes part in the choice like the others, also in a stage's button", () => {
    render(<Page items={rows} rows={rows} />);
    enter();
    click(screen.getByRole("button", { name: "Select stage: Stage 1" }));
    expect(chosen()).toEqual(["Place A", "Old house"]);
  });
});
