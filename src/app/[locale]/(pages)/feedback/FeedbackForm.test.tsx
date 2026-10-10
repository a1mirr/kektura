// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../../../../../messages/en.json";

const submitFeedback = vi.fn();
vi.mock("./actions", () => ({ submitFeedback: (input: unknown) => submitFeedback(input) }));

import FeedbackForm from "./FeedbackForm";

afterEach(() => {
  cleanup();
  submitFeedback.mockReset();
});

function renderForm(stamp: { code: string; name: string } | null = null) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FeedbackForm stamp={stamp} />
    </NextIntlClientProvider>,
  );
  return {
    box: screen.getByLabelText("Your message") as HTMLTextAreaElement,
    send: () => screen.getByRole("button", { name: /^(Submit feedback|Sending…)$/ }) as HTMLButtonElement,
  };
}

const type = (box: HTMLElement, text: string) => fireEvent.change(box, { target: { value: text } });
const submit = () => act(async () => void fireEvent.submit(screen.getByRole("button", { name: /Submit feedback/ })));

describe("spec 0017: feedback form", () => {
  it("AC-1, AC-2: a labelled box with a counter; sending needs some text", () => {
    const { box, send } = renderForm();
    expect(send().disabled).toBe(true);
    expect(screen.getByText("0 / 2000")).toBeTruthy();
    type(box, "  😀 hi ");
    expect(screen.getByText("4 / 2000")).toBeTruthy();
    expect(send().disabled).toBe(false);
    type(box, "   ");
    expect(send().disabled).toBe(true);
  });

  it("AC-2: the box can't take more than the limit", () => {
    expect(renderForm().box.maxLength).toBe(2000);
  });

  it("AC-6: tells the sender that the email goes along when signed in", () => {
    renderForm();
    expect(screen.getByText(messages.feedback.note)).toBeTruthy();
  });

  it("AC-8: a success clears the form, says so, and the form can be used again", async () => {
    submitFeedback.mockResolvedValue({ ok: true });
    const { box, send } = renderForm();
    type(box, "Great trail");
    await submit();
    expect(submitFeedback).toHaveBeenCalledWith({ message: "Great trail", website: "", locale: "en" });
    expect(screen.getByRole("status").textContent).toBe(messages.feedback.success);
    expect(box.value).toBe("");
    type(box, "One more thing");
    expect(send().disabled).toBe(false);
  });

  it("AC-8: while sending, the button says so and can't be pressed again", async () => {
    let finish!: (r: { ok: true }) => void;
    submitFeedback.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { box, send } = renderForm();
    type(box, "Hello");
    await submit();
    expect(send().textContent).toBe("Sending…");
    expect(send().disabled).toBe(true);
    await act(async () => finish({ ok: true }));
    expect(send().textContent).toBe("Submit feedback");
  });

  it.each([
    ["too_long", messages.feedback.tooLong],
    ["rate_limited", messages.feedback.rateLimited],
    ["failed", messages.feedback.error],
    ["invalid", messages.feedback.error],
  ])("AC-8: the answer `%s` shows its own message and keeps the text", async (reason, text) => {
    submitFeedback.mockResolvedValue({ ok: false, reason });
    const { box } = renderForm();
    type(box, "Keep me");
    await submit();
    expect(screen.getByRole("alert").textContent).toBe(text);
    expect(box.value).toBe("Keep me");
  });

  it("AC-8: a network error (the action rejects) shows the generic error", async () => {
    submitFeedback.mockRejectedValue(new Error("offline"));
    const { box } = renderForm();
    type(box, "Hello");
    await submit();
    expect(screen.getByRole("alert").textContent).toBe(messages.feedback.error);
  });

  it("AC-7: the hidden honeypot field is sent along, hidden from people and screen readers", async () => {
    submitFeedback.mockResolvedValue({ ok: true });
    const { box } = renderForm();
    const trap = document.querySelector('input[name="website"]') as HTMLInputElement;
    expect(trap.tabIndex).toBe(-1);
    expect(trap.closest("[aria-hidden='true']")).not.toBeNull();
    type(box, "Hello");
    fireEvent.change(trap, { target: { value: "http://spam.example" } });
    await submit();
    expect(submitFeedback).toHaveBeenCalledWith({ message: "Hello", website: "http://spam.example", locale: "en" });
  });
});

describe("spec 0017: the form opened for a stamp", () => {
  const stamp = { code: "OKTPH_84_B", name: "Lokó-pihenő" };

  it("AC-11: it says which stamp the message is about, with the name it was given", () => {
    renderForm(stamp);
    expect(document.querySelector("[data-feedback-stamp]")?.textContent).toBe("About the stamp Lokó-pihenő (OKTPH_84_B)");
  });

  it("AC-11: without a stamp there is no such line", () => {
    renderForm();
    expect(document.querySelector("[data-feedback-stamp]")).toBeNull();
  });

  it("AC-11: the stamp's code travels with the message, nothing else does, and the sender's words are what they typed", async () => {
    submitFeedback.mockResolvedValue({ ok: true });
    const { box } = renderForm(stamp);
    type(box, "It moved");
    await submit();
    expect(submitFeedback).toHaveBeenCalledWith({ message: "It moved", website: "", locale: "en", stamp: "OKTPH_84_B" });
    expect(box.value).toBe("");
  });

  it("AC-11: the line takes its share of the 2000 characters: the box and the counter show what is left", () => {
    const { box } = renderForm(stamp);
    const left = 2000 - [..."Stamp: Lokó-pihenő (OKTPH_84_B)\n\n"].length;
    expect(box.maxLength).toBe(left);
    expect(screen.getByText(`0 / ${left}`)).toBeTruthy();
  });
});
