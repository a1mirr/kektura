// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../messages/en.json";

const refresh = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh }) }));
const createShareCard = vi.fn();
const deleteShareCard = vi.fn();
vi.mock("@/app/[locale]/stats/actions", () => ({
  createShareCard: (...a: unknown[]) => createShareCard(...a),
  deleteShareCard: (...a: unknown[]) => deleteShareCard(...a),
}));

import SharePanel, { type ShareItem } from "./SharePanel";

const ITEM: ShareItem = {
  id: "3f0c1b6e-9d41-4c55-8a39-2b7a5c1e9d02",
  url: `https://kektura-tracker.com/en/share/${"ab".repeat(16)}`,
  telegramUrl: "https://t.me/share/url?url=x&text=y",
  line: "54% · 87 / 161 stamps",
  created: "Created October 8, 2026",
  named: false,
};

beforeEach(() => {
  createShareCard.mockResolvedValue({ ok: true });
  deleteShareCard.mockResolvedValue({ ok: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPanel(items: ShareItem[] = []) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SharePanel items={items} />
    </NextIntlClientProvider>,
  );
}

const click = (element: HTMLElement) => act(async () => fireEvent.click(element));

describe("spec 0039: the share panel", () => {
  describe("AC-6: creating a card", () => {
    it("says that the page is public and shows roughly where you are, before anything is created", () => {
      renderPanel();
      expect(screen.getByText(/Anyone with the link can see the card/)).toBeTruthy();
      expect(screen.getByText(/shows roughly where you are on the trail/)).toBeTruthy();
      expect(createShareCard).not.toHaveBeenCalled();
    });

    it("AC-3: creates an anonymous card unless the name is ticked, then reloads the page's data", async () => {
      renderPanel();
      await click(screen.getByRole("button", { name: "Create a card" }));
      expect(createShareCard).toHaveBeenLastCalledWith(false);
      expect(refresh).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByLabelText("Show my name on the card"));
      await click(screen.getByRole("button", { name: "Create a card" }));
      expect(createShareCard).toHaveBeenLastCalledWith(true);
    });

    it("says so when the limit is reached or the action fails, and does not reload", async () => {
      renderPanel();
      createShareCard.mockResolvedValueOnce({ ok: false, reason: "limit" });
      await click(screen.getByRole("button", { name: "Create a card" }));
      expect(screen.getByRole("alert").textContent).toBe("You already have the maximum of 20 cards. Delete one to create another.");

      createShareCard.mockResolvedValueOnce({ ok: false, reason: "failed" });
      await click(screen.getByRole("button", { name: "Create a card" }));
      expect(screen.getByRole("alert").textContent).toBe("That didn't work. Please try again.");
      expect(refresh).not.toHaveBeenCalled();
    });
  });

  describe("AC-6: a card in the list", () => {
    it("shows its numbers, its date and whether it is anonymous, with the link in a field to copy by hand", () => {
      renderPanel([ITEM, { ...ITEM, id: "other", named: true }]);
      expect(screen.getAllByText("54% · 87 / 161 stamps")).toHaveLength(2);
      expect(screen.getAllByText(/Created October 8, 2026 · anonymous/)).toHaveLength(1);
      expect(screen.getAllByText(/Created October 8, 2026 · with your name/)).toHaveLength(1);
      expect((screen.getAllByLabelText("Link to the card")[0] as HTMLInputElement).value).toBe(ITEM.url);
    });

    it("AC-9: offers Telegram's share dialog and the page itself in a new tab, without handing over the opener", () => {
      renderPanel([ITEM]);
      const telegram = screen.getByRole("link", { name: "Send to Telegram" });
      expect(telegram.getAttribute("href")).toBe(ITEM.telegramUrl);
      expect(telegram.getAttribute("target")).toBe("_blank");
      expect(telegram.getAttribute("rel")).toContain("noopener");
      expect(screen.getByRole("link", { name: "Open" }).getAttribute("href")).toBe(ITEM.url);
    });

    it("copies the link to the clipboard and says so", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      renderPanel([ITEM]);
      await click(screen.getByRole("button", { name: "Copy link" }));
      expect(writeText).toHaveBeenCalledWith(ITEM.url);
      expect(screen.getByRole("button", { name: "Link copied" })).toBeTruthy();
    });

    it("when the clipboard refuses, selects the link so it can be copied by hand", async () => {
      Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
      renderPanel([ITEM]);
      const field = screen.getAllByLabelText("Link to the card")[0] as HTMLInputElement;
      const select = vi.spyOn(field, "select");
      await click(screen.getByRole("button", { name: "Copy link" }));
      expect(select).toHaveBeenCalled();
    });
  });

  describe("AC-6: deleting a card", () => {
    it("asks first and deletes only on the second press", async () => {
      renderPanel([ITEM]);
      await click(screen.getByRole("button", { name: "Delete" }));
      expect(screen.getByText("Delete this card? Its link stops working.")).toBeTruthy();
      expect(deleteShareCard).not.toHaveBeenCalled();

      await click(screen.getByRole("button", { name: "Yes, delete" }));
      expect(deleteShareCard).toHaveBeenCalledWith(ITEM.id);
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("Cancel closes the question and deletes nothing", async () => {
      renderPanel([ITEM]);
      await click(screen.getByRole("button", { name: "Delete" }));
      await click(screen.getByRole("button", { name: "Cancel" }));
      expect(deleteShareCard).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
    });

    it("a failed delete says so and keeps the list as it is", async () => {
      deleteShareCard.mockResolvedValueOnce({ ok: false, reason: "failed" });
      renderPanel([ITEM]);
      await click(screen.getByRole("button", { name: "Delete" }));
      await click(screen.getByRole("button", { name: "Yes, delete" }));
      expect(screen.getByRole("alert").textContent).toBe("That didn't work. Please try again.");
      expect(refresh).not.toHaveBeenCalled();
    });
  });

  it("says there are no cards yet when there are none", () => {
    renderPanel();
    expect(screen.getByText("No cards yet.")).toBeTruthy();
  });
});
