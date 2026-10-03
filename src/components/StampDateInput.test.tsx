// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../messages/en.json";
import type { ActionResult } from "@/lib/action-result";
import { maxStampDate } from "@/lib/stamp-date";

const refresh = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh }) }));

import StampDateInput from "./StampDateInput";

// The first day the component rejects: the day after tomorrow (UTC), whenever the tests run.
const PAST_MAX = new Date(Date.parse(maxStampDate()) + 86_400_000).toISOString().slice(0, 10);
const MAX = "2999-12-31"; // the page passes tomorrow (UTC); anything above it is out of range for the field
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

function setup(onSave: (date: string) => Promise<ActionResult>, value = "2026-09-01", max = "2026-10-03") {
  const view = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <StampDateInput value={value} max={max} onSave={onSave} />
    </NextIntlClientProvider>,
  );
  const input = screen.getByLabelText(messages.dashboard.stampDate) as HTMLInputElement;
  const rerender = (nextValue: string) =>
    view.rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <StampDateInput value={nextValue} max={max} onSave={onSave} />
      </NextIntlClientProvider>,
    );
  return { input, rerender };
}

const ok = () => vi.fn<(date: string) => Promise<ActionResult>>(async () => ({ ok: true }));
const edit = (input: HTMLElement, value: string) => act(() => void fireEvent.change(input, { target: { value } }));
const blur = (input: HTMLElement) => act(() => void fireEvent.blur(input));
const wait = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

describe("spec 0016: the date field", () => {
  it("AC-5: an accessible date field showing the saved date, limited to the valid range", () => {
    const { input } = setup(ok());
    expect(input.type).toBe("date");
    expect(input.value).toBe("2026-09-01");
    expect(input.min).toBe("1938-01-01");
    expect(input.max).toBe("2026-10-03");
  });

  it("AC-6: a valid, changed date is saved once, after a pause of 700 ms", async () => {
    const onSave = ok();
    const { input } = setup(onSave);
    await edit(input, "2026-09-15");
    await wait(699);
    expect(onSave).not.toHaveBeenCalled();
    await wait(2);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("2026-09-15");
    await wait(5000);
    expect(onSave).toHaveBeenCalledTimes(1); // and not again
  });

  it("AC-6: typing a date key by key is one save: only the final date is sent", async () => {
    const onSave = ok();
    const { input } = setup(onSave, "2026-09-01");
    // What Chrome reports while "2025" is typed into the year and then "26" into the day: the year's
    // prefixes are not stamp dates (below 1938), but the day passes through a complete date, 02.
    for (const step of ["0002-09-01", "0020-09-01", "0202-09-01", "2025-09-01", "2025-09-02", "2025-09-26"]) {
      await edit(input, step);
      await wait(50);
    }
    await wait(1000);
    expect(onSave.mock.calls).toEqual([["2025-09-26"]]);
  });

  it("AC-6: rapid edits restart the pause: one save with the last value", async () => {
    const onSave = ok();
    const { input } = setup(onSave);
    await edit(input, "2026-09-02");
    await wait(500);
    await edit(input, "2026-09-03");
    await wait(500);
    expect(onSave).not.toHaveBeenCalled();
    await wait(300);
    expect(onSave.mock.calls).toEqual([["2026-09-03"]]);
  });

  it("AC-6: never sends an empty, below-range or above-range date, nor the unchanged one", async () => {
    const onSave = ok();
    const { input } = setup(onSave);
    for (const value of ["", "1937-12-31", "0002-10-02", PAST_MAX, "2999-01-01", "2026-09-01"]) {
      await edit(input, value);
      await wait(2000);
    }
    expect(onSave).not.toHaveBeenCalled();
  });

  it("AC-6: leaving the field saves a valid date at once, and the pause no longer fires a second save", async () => {
    const onSave = ok();
    const { input } = setup(onSave);
    await edit(input, "2026-09-20");
    await blur(input);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("2026-09-20");
    await wait(3000);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("AC-6: leaving the field with an empty or out-of-range value restores the saved date", async () => {
    const onSave = ok();
    const { input } = setup(onSave);
    for (const value of ["", "2999-01-01", "1900-05-05"]) {
      await edit(input, value);
      await blur(input);
      expect(input.value, value).toBe("2026-09-01");
    }
    await wait(2000);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("AC-7: while saving, the field stays enabled (it keeps focus); the page shows no error", async () => {
    let finish!: (r: ActionResult) => void;
    const onSave = vi.fn(() => new Promise<ActionResult>((resolve) => (finish = resolve)));
    const { input } = setup(onSave);
    input.focus();
    await edit(input, "2026-09-15");
    await wait(700);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(input.disabled).toBe(false);
    expect(input.getAttribute("aria-busy")).toBe("true");
    expect(document.activeElement).toBe(input);
    await act(async () => finish({ ok: true }));
    expect(input.getAttribute("aria-busy")).toBe("false");
    expect(input.value).toBe("2026-09-15");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("AC-7: an edit made while a save is running is saved after it, never at the same time", async () => {
    const resolvers: ((r: ActionResult) => void)[] = [];
    const onSave = vi.fn(() => new Promise<ActionResult>((resolve) => resolvers.push(resolve)));
    const { input } = setup(onSave);
    await edit(input, "2026-09-10");
    await wait(700); // first save starts
    await edit(input, "2026-09-11");
    await wait(2000); // the second must wait for the first
    expect(onSave.mock.calls).toEqual([["2026-09-10"]]);
    await act(async () => resolvers[0]({ ok: true }));
    await wait(700);
    expect(onSave.mock.calls).toEqual([["2026-09-10"], ["2026-09-11"]]);
  });

  it("AC-7: a failed save restores the saved date and shows the usual error; it doesn't retry by itself", async () => {
    const onSave = vi.fn(async (): Promise<ActionResult> => ({ ok: false, reason: "failed" }));
    const { input } = setup(onSave);
    await edit(input, "2026-09-15");
    await wait(700);
    expect(input.value).toBe("2026-09-01");
    expect(screen.getByRole("alert").textContent).toBe(messages.dashboard.actionFailed);
    await wait(5000);
    expect(onSave).toHaveBeenCalledTimes(1);
    await edit(input, "2026-09-16"); // trying again clears the message
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("AC-7: a network error (the action rejects) is handled like a failed save", async () => {
    const onSave = vi.fn(async (): Promise<ActionResult> => {
      throw new Error("offline");
    });
    const { input } = setup(onSave);
    await edit(input, "2026-09-15");
    await wait(700);
    expect(input.value).toBe("2026-09-01");
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("AC-7: an expired session refreshes the page instead of showing an error", async () => {
    const onSave = vi.fn(async (): Promise<ActionResult> => ({ ok: false, reason: "unauthorized" }));
    const { input } = setup(onSave);
    await edit(input, "2026-09-15");
    await wait(700);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("the date follows the server when it changes and the user isn't editing", async () => {
    const { input, rerender } = setup(ok(), "2026-09-01", MAX);
    rerender("2026-08-15");
    expect(input.value).toBe("2026-08-15");
  });

  it("the date from the server doesn't overwrite what the user is typing", async () => {
    const { input, rerender } = setup(ok(), "2026-09-01", MAX);
    await edit(input, "2026-09-20");
    rerender("2026-08-15");
    expect(input.value).toBe("2026-09-20");
  });
});
