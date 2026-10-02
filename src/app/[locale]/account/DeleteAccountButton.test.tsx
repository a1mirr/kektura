// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../../../../messages/en.json";
import type { ActionResult } from "@/lib/action-result";

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
const deleteAccountAction = vi.fn<() => Promise<ActionResult>>();
vi.mock("./actions", () => ({ deleteAccountAction: () => deleteAccountAction() }));

import DeleteAccountButton from "./DeleteAccountButton";

const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const s = messages.account;
const renderButton = () =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DeleteAccountButton />
    </NextIntlClientProvider>,
  );
const press = (name: string) => act(async () => void fireEvent.click(screen.getByRole("button", { name })));
const open = () => press(s.deleteAccount);
const confirm = () => press(s.deleteButton);

describe("spec 0014: delete account button", () => {
  it("AC-9: starts as one button; nothing is deleted by pressing it", async () => {
    renderButton();
    expect(screen.queryByText(s.deleteConfirm)).toBeNull();
    await open();
    expect(screen.getByText(s.deleteConfirm)).toBeTruthy();
    expect(deleteAccountAction).not.toHaveBeenCalled();
  });

  it("AC-9: cancelling goes back without deleting", async () => {
    renderButton();
    await open();
    await press(s.cancel);
    expect(screen.queryByText(s.deleteConfirm)).toBeNull();
    expect(screen.getByRole("button", { name: s.deleteAccount })).toBeTruthy();
    expect(deleteAccountAction).not.toHaveBeenCalled();
  });

  it("AC-9: confirming deletes once and returns to the landing page, buttons staying disabled", async () => {
    deleteAccountAction.mockResolvedValue({ ok: true });
    renderButton();
    await open();
    await confirm();
    expect(deleteAccountAction).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/");
    expect((screen.getByRole("button", { name: s.deleteButton }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: s.cancel }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("AC-11: while deleting, neither button can be pressed again", async () => {
    let finish!: (r: ActionResult) => void;
    deleteAccountAction.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderButton();
    await open();
    await confirm();
    expect((screen.getByRole("button", { name: s.deleteButton }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: s.cancel }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => finish({ ok: false, reason: "failed" }));
    expect((screen.getByRole("button", { name: s.deleteButton }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("AC-11: a refused deletion says so in the page (no alert), and can be retried", async () => {
    deleteAccountAction.mockResolvedValueOnce({ ok: false, reason: "failed" }).mockResolvedValueOnce({ ok: true });
    renderButton();
    await open();
    await confirm();
    expect(screen.getByRole("alert").textContent).toBe(s.deleteFailed);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    await confirm();
    expect(replace).toHaveBeenCalledWith("/");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("AC-11: a network error (the action rejects) is handled like a refusal", async () => {
    deleteAccountAction.mockRejectedValue(new Error("offline"));
    renderButton();
    await open();
    await confirm();
    expect(screen.getByRole("alert").textContent).toBe(s.deleteFailed);
    expect((screen.getByRole("button", { name: s.deleteButton }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("AC-11: an expired session refreshes the page, which redirects, instead of showing an error", async () => {
    deleteAccountAction.mockResolvedValue({ ok: false, reason: "unauthorized" });
    renderButton();
    await open();
    await confirm();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("AC-11: cancelling clears an earlier error", async () => {
    deleteAccountAction.mockResolvedValue({ ok: false, reason: "failed" });
    renderButton();
    await open();
    await confirm();
    await press(s.cancel);
    await open();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
