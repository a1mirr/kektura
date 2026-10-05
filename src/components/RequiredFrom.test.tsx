// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import messages from "../../messages/en.json";
import RequiredFrom from "./RequiredFrom";

afterEach(cleanup);

function setup(props: Partial<Parameters<typeof RequiredFrom>[0]> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RequiredFrom requiredFrom="2025-05-08" waived={false} tolerance={false} {...props} />
    </NextIntlClientProvider>,
  );
}

describe("spec 0001: the date a stamp is required from", () => {
  it("AC-19: shows the date in the page's language, whatever the time zone", () => {
    setup();
    expect(screen.getByText(/Stamp required from/).textContent).toBe("Stamp required from May 8, 2025");
  });

  it("AC-19: a stamp that is still needed says so; one the user walked before it was required says that instead", () => {
    setup();
    expect(screen.getByText(messages.dashboard.requiredHint)).toBeTruthy();
    expect(screen.queryByText(messages.dashboard.notRequired)).toBeNull();
    cleanup();
    setup({ waived: true });
    expect(screen.getByText(messages.dashboard.notRequired)).toBeTruthy();
    expect(screen.queryByText(messages.dashboard.requiredHint)).toBeNull();
  });

  it("AC-19: on a friend's page the waiver and the hint are theirs, not the viewer's", () => {
    setup({ waived: true, who: "friend" });
    expect(screen.getByText(messages.dashboard.notRequiredFriend)).toBeTruthy();
    expect(screen.queryByText(messages.dashboard.notRequired)).toBeNull();
    cleanup();
    setup({ who: "friend" });
    expect(screen.getByText(messages.dashboard.requiredHintFriend)).toBeTruthy();
    expect(screen.queryByText(messages.dashboard.requiredHint)).toBeNull();
  });

  it("AC-19: the note is also plain text for a page without JavaScript", () => {
    // React leaves a noscript empty in the browser; the server-rendered HTML is what a visitor without JavaScript gets.
    const html = renderToString(
      <NextIntlClientProvider locale="en" messages={messages}>
        <RequiredFrom requiredFrom="2025-05-08" waived={false} tolerance />
      </NextIntlClientProvider>,
    );
    const note = html.match(/<noscript>(.*?)<\/noscript>/)![1];
    expect(note).toContain(messages.dashboard.requiredWhy);
    expect(note).toContain(messages.dashboard.requiredTolerance);
  });

  it("AC-19: the date is a button (keyboard and touch) that opens the explanation, and Escape closes it", () => {
    setup();
    const button = screen.getByRole("button", { name: /May 8, 2025/ });
    const why = screen.getByText(messages.dashboard.requiredWhy);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(why.hidden).toBe(true);
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(why.hidden).toBe(false);
    expect(button.getAttribute("aria-controls")).toBe(why.id);
    fireEvent.keyDown(button, { key: "Escape" });
    expect(why.hidden).toBe(true);
  });

  it("AC-19: the tolerance sentence is only there for stamps the MTSZ announced it for", () => {
    setup();
    expect(screen.getByText(messages.dashboard.requiredWhy).textContent).not.toContain("tolerance");
    cleanup();
    setup({ tolerance: true });
    expect(screen.getByText(new RegExp(messages.dashboard.requiredTolerance)).textContent).toContain(messages.dashboard.requiredWhy);
  });
});
