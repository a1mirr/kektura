// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import messages from "../../messages/en.json";
import RetiredRow from "./RetiredRow";
import RetiredToggle from "./RetiredToggle";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function setup(listed: boolean) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RetiredToggle />
      <ul>
        <RetiredRow id="place-R" listed={listed}>
          Old house
        </RetiredRow>
      </ul>
    </NextIntlClientProvider>,
  );
  return { row: () => document.getElementById("place-R") as HTMLElement, toggle: screen.getByLabelText("Show retired stamps") as HTMLInputElement };
}

describe("spec 0001: showing retired stamps", () => {
  it("AC-23: a retired stamp the rule does not list is hidden by default, one it lists is not", () => {
    expect(setup(false).row().hidden).toBe(true);
    cleanup();
    expect(setup(true).row().hidden).toBe(false);
  });

  it("AC-24: the toggle shows every retired stamp, and the choice is remembered", () => {
    const { row, toggle } = setup(false);
    expect(toggle.checked).toBe(false);
    act(() => void fireEvent.click(toggle));
    expect(row().hidden).toBe(false);
    expect(toggle.checked).toBe(true);
    expect(localStorage.getItem("kektura:showRetired")).toBe("1");
    cleanup();
    expect(setup(false).row().hidden).toBe(false); // a later visit starts as the user left it
    cleanup();
    localStorage.setItem("kektura:showRetired", "0");
    expect(setup(false).row().hidden).toBe(true);
  });

  it("AC-24: it also works when the browser cannot store anything", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
    try {
      const { row, toggle } = setup(false);
      act(() => void fireEvent.click(toggle));
      expect(row().hidden).toBe(false);
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
