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
import BulkDateBar from "./BulkDateBar";
import BulkDatesProvider from "./BulkDatesProvider";
import BulkStageButton from "./BulkStageButton";
import RequiredFrom from "./RequiredFrom";
import StageControls from "./StageControls";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  setStampDates.mockImplementation(async () => ({ ok: true }));
});

const place = (key: string, stage: number, retiredOn?: string): BulkItem => ({
  id: placeItemId(key),
  kind: "place",
  placeKey: key,
  stage,
  name: `Place ${key}`,
  ...(retiredOn ? { retiredOn } : {}),
});
const extra = (id: number): BulkItem => ({ id: extraItemId(id), kind: "extra", extraId: id, name: `Extra ${id}` });

// Four stamped places in two stages and an extra stamp; the page also shows a row U that is not stamped, so it has no checkbox.
const ITEMS: BulkItem[] = [place("A", 1), place("B", 1), place("C", 1), place("D", 2), extra(7)];
const ROWS = [place("A", 1), place("B", 1), place("U", 1), place("C", 1), place("D", 2), extra(7)];

function Page({ items = ITEMS, rows = ROWS }: { items?: BulkItem[]; rows?: BulkItem[] }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <BulkDatesProvider items={items} max="2999-01-01">
        <StageControls />
        <BulkDateBar />
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

const BAR = "Change the date of several stamps";
const bar = () => screen.getByRole("region", { name: BAR });
const noBar = () => screen.queryByRole("region", { name: BAR });
const modeButton = () => screen.getByRole("button", { name: "Change dates" });
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
  it("AC-14: outside the mode no row has a checkbox and there is no bar; the button opens the mode", () => {
    render(<Page />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(noBar()).toBeNull();
    expect(modeButton().getAttribute("aria-pressed")).toBe("false");
    enter();
    expect(modeButton().getAttribute("aria-pressed")).toBe("true");
    expect(bar()).toBeTruthy();
  });

  it("AC-14: in the mode every stamped row has a checkbox named after it, and a row that is not stamped has none", () => {
    render(<Page />);
    enter();
    expect(screen.getAllByRole("checkbox").map((c) => c.getAttribute("aria-label"))).toEqual([
      "Select Place A",
      "Select Place B",
      "Select Place C",
      "Select Place D",
      "Select Extra 7",
    ]);
    expect(screen.queryByRole("checkbox", { name: "Select Place U" })).toBeNull();
  });

  it("AC-14: Cancel, Escape and the mode button leave the mode and forget the choice", () => {
    render(<Page />);
    for (const leave of [
      () => click(screen.getByRole("button", { name: "Cancel" })),
      () => act(() => void fireEvent.keyDown(window, { key: "Escape" })),
      () => click(modeButton()),
    ]) {
      enter();
      choose("Place A");
      expect(chosen()).toEqual(["Place A"]);
      leave();
      expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
      expect(noBar()).toBeNull();
      enter();
      expect(chosen()).toEqual([]); // not remembered
      click(screen.getByRole("button", { name: "Cancel" }));
    }
  });

  it("AC-14: the server's HTML has neither the mode button nor a stage button: without JavaScript the mode is not offered", () => {
    const html = renderToString(<Page />);
    expect(html).not.toContain("Change dates");
    expect(html).not.toContain("Set date");
    expect(html).not.toContain("checkbox");
    expect(html).toContain("Expand all"); // the rest of the controls are there
  });

  it("AC-14: a page without the provider (a friend's page) has no mode button", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <StageControls />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByRole("button", { name: "Change dates" })).toBeNull();
    expect(screen.getByRole("button", { name: "Expand all" })).toBeTruthy();
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
          <StageControls />
          <BulkDateBar />
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

describe("spec 0016: choosing stamps", () => {
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

  it("AC-15: a shift-click chooses the range from the last chosen row, in the page's order, across the places and the extras", () => {
    render(<Page />);
    enter();
    choose("Place B");
    click(box("Extra 7"), { shiftKey: true });
    expect(chosen()).toEqual(["Place B", "Place C", "Place D", "Extra 7"]);
    click(box("Place C"), { shiftKey: true }); // C is chosen: the range from the anchor (the extra) down to C is cleared
    expect(chosen()).toEqual(["Place B"]);
  });

  it("AC-15: the bar's Select all chooses everything stamped, Clear nothing and Clear does not leave the mode", () => {
    render(<Page />);
    enter();
    click(screen.getByRole("button", { name: "Select all" }));
    expect(chosen()).toHaveLength(5);
    click(screen.getByRole("button", { name: "Clear" }));
    expect(chosen()).toEqual([]);
    expect(bar()).toBeTruthy();
  });

  it("AC-15: in the mode a stage's button adds the stamped places of that stage to the choice, and only those", () => {
    render(<Page />);
    enter();
    choose("Place D");
    click(screen.getByRole("button", { name: "Select stage: Stage 1" }));
    expect(chosen()).toEqual(["Place A", "Place B", "Place C", "Place D"]);
    expect(screen.queryByRole("button", { name: /Stage 3/ })).toBeNull(); // no stamp in stage 3: no button
    expect((box("Extra 7") as HTMLInputElement).checked).toBe(false); // the extras are not a stage's
  });

  it("AC-20: outside the mode a stage's button opens the mode with that stage's stamps chosen", () => {
    render(<Page />);
    click(screen.getByRole("button", { name: "Set date: Stage 2" }));
    expect(bar()).toBeTruthy();
    expect(chosen()).toEqual(["Place D"]);
    expect(screen.queryByRole("button", { name: /Set date/ })).toBeNull(); // in the mode the same place offers "Select stage"
    expect(screen.getByRole("button", { name: "Select stage: Stage 2" })).toBeTruthy();
  });

  it("AC-16: a chosen stamp that disappears from the page (removed meanwhile) is no longer chosen or counted", () => {
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

  it("AC-17: Apply sends the chosen places and extra stamps with the date, as one request", async () => {
    render(<Page />);
    enter();
    choose("Place A", "Place D", "Extra 7");
    type("2026-09-15");
    await act(async () => void fireEvent.click(apply()));
    expect(setStampDates).toHaveBeenCalledWith(["A", "D"], [7], "2026-09-15");
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

  it("AC-19: after a save that went through the mode closes, the choice is gone and a message names how many dates changed", async () => {
    render(<Page />);
    enter();
    choose("Place A", "Place B", "Extra 7");
    type("2026-09-15");
    await act(async () => void fireEvent.click(apply()));
    await waitFor(() => expect(noBar()).toBeNull());
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.getByText("3 dates changed").getAttribute("aria-live")).toBe("polite");
    enter(); // a new visit starts clean, without the old message
    expect(chosen()).toEqual([]);
    expect(screen.queryByText("3 dates changed")).toBeNull();
  });

  it("AC-19: one date is '1 date changed'", async () => {
    render(<Page />);
    enter();
    choose("Place A");
    type("2026-09-15");
    await act(async () => void fireEvent.click(apply()));
    await waitFor(() => expect(screen.getByText("1 date changed")).toBeTruthy());
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
    click(screen.getByRole("button", { name: "Set date: Stage 1" }));
    expect(chosen()).toEqual(["Place A", "Old house"]);
  });
});
