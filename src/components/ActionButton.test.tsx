// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../../messages/en.json";
import type { ActionResult } from "@/lib/action-result";

const refresh = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh }) }));

import ActionButton from "./ActionButton";

afterEach(() => {
  cleanup();
  refresh.mockClear();
});

function renderButton(action: () => Promise<ActionResult>) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ActionButton action={action} done={false}>
        Add stamp
      </ActionButton>
    </NextIntlClientProvider>,
  );
  return screen.getByRole("button", { name: "Add stamp" });
}

async function click(button: HTMLElement) {
  await act(async () => {
    fireEvent.click(button);
  });
}

describe("spec 0002: stamp buttons", () => {
  it("AC-9: the button is disabled while the action runs", async () => {
    let finish!: (r: ActionResult) => void;
    const button = renderButton(() => new Promise((resolve) => (finish = resolve)));
    await click(button);
    expect(button).toHaveProperty("disabled", true);
    await act(async () => finish({ ok: true }));
    expect(button).toHaveProperty("disabled", false);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("AC-10: a failed write shows the error message", async () => {
    await click(renderButton(async () => ({ ok: false, reason: "failed" })));
    expect(screen.getByRole("alert").textContent).toBe(messages.dashboard.actionFailed);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("AC-10: a network error (the action rejects) shows the error message too", async () => {
    await click(renderButton(() => Promise.reject(new Error("offline"))));
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("AC-11: an expired session refreshes the page (which redirects to sign-in) instead", async () => {
    await click(renderButton(async () => ({ ok: false, reason: "unauthorized" })));
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
