// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FlashMessage from "./FlashMessage";
import FriendActionButton, { friendButtonClass } from "./FriendActionButton";
import FriendActionGroup from "./FriendActionGroup";
import FriendConfirm from "./FriendConfirm";

afterEach(cleanup);

// A form like the page's: its action is a server action that takes a while and then redirects (here: a promise
// the test settles).
function pendingForm(label: string, tone?: "approve" | "danger") {
  let finish!: () => void;
  const action = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
  return { action, finish: () => act(async () => finish()), form: (
    <form action={action}>
      <FriendActionButton tone={tone}>{label}</FriendActionButton>
    </form>
  ) };
}

const press = (name: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });

describe("spec 0024: the Friends page buttons respond", () => {
  it("AC-17: a pressed button is disabled at once, shows a spinner and keeps its label in the layout", async () => {
    const { form, finish } = pendingForm("Approve");
    render(form);
    const button = screen.getByRole("button", { name: "Approve" });
    expect(button).toHaveProperty("disabled", false);
    await press("Approve");
    expect(button).toHaveProperty("disabled", true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.querySelector(".animate-spin")).not.toBeNull();
    // The label is still there, transparent: the button keeps its size and its name.
    expect(screen.getByText("Approve").className).toContain("opacity-0");
    await finish();
    expect(button).toHaveProperty("disabled", false);
    expect(button.querySelector(".animate-spin")).toBeNull();
    expect(button.getAttribute("aria-busy")).toBe("false");
  });

  it("AC-17: a second press while the request runs sends nothing more", async () => {
    const { form, action, finish } = pendingForm("Approve");
    render(form);
    await press("Approve");
    await press("Approve");
    expect(action).toHaveBeenCalledTimes(1);
    await finish();
  });

  it("AC-17: the other buttons of the same row are disabled while one runs, the buttons of other rows are not", async () => {
    const approve = pendingForm("Approve");
    const ignore = pendingForm("Ignore");
    const other = pendingForm("Other row");
    render(
      <>
        <FriendActionGroup>
          {approve.form}
          {ignore.form}
        </FriendActionGroup>
        <FriendActionGroup>{other.form}</FriendActionGroup>
      </>,
    );
    await press("Approve");
    expect(screen.getByRole("button", { name: "Ignore" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Other row" })).toHaveProperty("disabled", false);
    await press("Ignore"); // disabled: nothing happens
    expect(ignore.action).not.toHaveBeenCalled();
    await approve.finish();
    expect(screen.getByRole("button", { name: "Ignore" })).toHaveProperty("disabled", false);
    expect(screen.getByRole("button", { name: "Approve" })).toHaveProperty("disabled", false);
  });

  it("AC-20: every tone has a hover and a pressed look, only for an enabled button, a focus ring and a 44 px target", () => {
    for (const tone of ["neutral", "primary", "approve", "danger", "dangerOutline"] as const) {
      const classes = friendButtonClass(tone).split(" ");
      expect(classes.some((c) => c.startsWith("not-disabled:hover:bg-")), `${tone} hover`).toBe(true);
      expect(classes.some((c) => c.startsWith("not-disabled:active:bg-")), `${tone} pressed`).toBe(true);
      expect(classes, `${tone} nudge`).toContain("not-disabled:active:translate-y-px");
      expect(classes, `${tone} focus`).toContain("focus-visible:outline-2");
      expect(classes, `${tone} height`).toContain("min-h-11");
      expect(classes, `${tone} width`).toContain("min-w-11");
      expect(classes.filter((c) => c.startsWith("hover:") || c.startsWith("active:")), `${tone} on a disabled button`).toEqual([]);
    }
  });
});

describe("spec 0024: confirmation of the two actions that cannot be undone", () => {
  function renderConfirm() {
    const action = vi.fn();
    render(
      <FriendConfirm label="Remove" question="Remove Ana from your friends?" cancelLabel="Cancel">
        <form action={action}>
          <FriendActionButton tone="danger">Yes, remove</FriendActionButton>
        </form>
      </FriendConfirm>,
    );
    return { action, details: document.querySelector("details") as HTMLDetailsElement };
  }

  it("AC-19: it starts closed, the first press does not submit, and the question is in the page", () => {
    const { action, details } = renderConfirm();
    expect(details.open).toBe(false);
    expect(screen.getByText("Remove").tagName).toBe("SUMMARY");
    expect(screen.getByText("Remove Ana from your friends?")).toBeTruthy();
    fireEvent.click(screen.getByText("Remove"));
    expect(action).not.toHaveBeenCalled();
  });

  it("AC-19: the confirming button is a plain submit button of a form; Cancel closes the question", async () => {
    const { action, details } = renderConfirm();
    details.open = true;
    expect(screen.getByRole("button", { name: "Yes, remove" }).closest("form")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(details.open).toBe(false);
    expect(action).not.toHaveBeenCalled();
    details.open = true;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, remove" }));
    });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("AC-19: Escape closes the question", () => {
    const { details } = renderConfirm();
    details.open = true;
    fireEvent.keyDown(screen.getByRole("button", { name: "Cancel" }), { key: "Escape" });
    expect(details.open).toBe(false);
  });
});

describe("spec 0024: the answer on the Friends page", () => {
  it("AC-18: a success is a polite status, a failure an alert", () => {
    render(<FlashMessage kind="ok">Name saved.</FlashMessage>);
    expect(screen.getByRole("status").textContent).toBe("Name saved.");
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    cleanup();
    render(<FlashMessage kind="error">Something went wrong.</FlashMessage>);
    expect(screen.getByRole("alert").textContent).toBe("Something went wrong.");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
