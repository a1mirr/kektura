// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../messages/en.json";

const refresh = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh }) }));
const setPlacesStamped = vi.fn(async () => ({ ok: true }));
const setStampDate = vi.fn(async () => ({ ok: true }));
vi.mock("@/app/[locale]/dashboard/actions", () => ({
  setPlacesStamped: (...args: unknown[]) => (setPlacesStamped as (...a: unknown[]) => unknown)(...args),
  setStampDate: (...args: unknown[]) => (setStampDate as (...a: unknown[]) => unknown)(...args),
}));

import RetiredStampControl from "./RetiredStampControl";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

function setup(props: { stamped?: boolean; date?: string } = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RetiredStampControl
        placeKey="R"
        name="Old house"
        stamped={props.stamped ?? false}
        date={props.date}
        latest="2014-11-20"
        latestText="November 20, 2014"
      />
    </NextIntlClientProvider>,
  );
}

const add = () => screen.getByRole("button", { name: /retired stamp Old house/i }) as HTMLButtonElement;
const type = (value: string) => act(() => void fireEvent.change(screen.getByPlaceholderText("yyyy-mm-dd"), { target: { value } }));

describe("spec 0001: the control of a retired stamp", () => {
  it("AC-25: collecting one asks for the day, and nothing is sent until it is a real day before it retired", async () => {
    setup();
    expect(add().disabled).toBe(true); // no "today" to default to
    for (const bad of ["2014-11-21", "2026-10-05", "2014-02-30", "2014-9-5", "x"]) {
      type(bad);
      expect(add().disabled, bad).toBe(true);
    }
    type("2014-11-20"); // the last day it was valid
    expect(add().disabled).toBe(false);
    await act(async () => void fireEvent.click(add()));
    expect(setPlacesStamped).toHaveBeenCalledWith(["R"], true, "2014-11-20");
  });

  it("AC-25: the field says how late the date may be, and the button's name says the stamp is retired", () => {
    setup();
    expect(screen.getByLabelText(/November 20, 2014/)).toBeTruthy();
    expect(add().getAttribute("aria-label")).toBe("Add retired stamp Old house");
  });

  it("AC-25: a collected one has its date field, limited to the day before it retired, and a remove button that names it", async () => {
    setup({ stamped: true, date: "2014-06-01" });
    const field = screen.getByLabelText(messages.dashboard.stampDate) as HTMLInputElement;
    expect(field.value).toBe("2014-06-01");
    // a later day is never saved, however long the user waits
    act(() => void fireEvent.change(field, { target: { value: "2014-11-21" } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(2000)));
    act(() => void fireEvent.blur(field));
    expect(setStampDate).not.toHaveBeenCalled();
    expect(field.value).toBe("2014-06-01");
    act(() => void fireEvent.change(field, { target: { value: "2014-10-01" } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(800)));
    expect(setStampDate).toHaveBeenCalledWith(["R"], "2014-10-01");

    await act(async () => void fireEvent.click(screen.getByRole("button", { name: "Remove retired stamp Old house" })));
    expect(setPlacesStamped).toHaveBeenCalledWith(["R"], false);
  });
});
