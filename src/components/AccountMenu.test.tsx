// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../../messages/en.json";

let pathname = "/dashboard";
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => pathname,
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en${href}`} {...rest}>
      {children}
    </a>
  ),
}));

import AccountMenu from "./AccountMenu";

afterEach(() => {
  cleanup();
  pathname = "/dashboard";
});

const s = messages.accountMenu;

function renderMenu({ friends = true } = {}) {
  const view = render(
    <>
      <button type="button">outside</button>
      <NextIntlClientProvider locale="en" messages={messages}>
        <AccountMenu friends={friends} />
      </NextIntlClientProvider>
    </>,
  );
  const details = view.container.querySelector("details")!;
  const summary = details.querySelector("summary")!;
  return { ...view, details, summary };
}

// jsdom does not toggle a `<details>` when its `<summary>` is clicked: what the browser does natively is done here, then the
// `toggle` event that React listens to is dispatched, as the browser would.
const toggle = async (details: HTMLDetailsElement) => {
  await act(async () => {
    details.open = !details.open;
    details.dispatchEvent(new Event("toggle"));
  });
};

describe("spec 0014: the account menu", () => {
  it("AC-22: a details with a summary named Account, closed at first, and the open list is plain links with no menu roles", () => {
    const { details, summary } = renderMenu();
    expect(details.open).toBe(false);
    expect(summary.tagName).toBe("SUMMARY");
    expect(summary.textContent).toBe(s.label);
    expect(screen.getByRole("group")).toBe(details);
    expect(details.querySelector("[role=menu], [role=menuitem]")).toBeNull();
    expect(details.querySelector("ul")).not.toBeNull();
  });

  it("AC-21: the entries are links to My stats, Friends and Settings in this order, in the page's language, then a sign-out form", () => {
    const { details } = renderMenu();
    const links = [...details.querySelectorAll("a")];
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      [s.stats, "/en/stats"],
      [s.friends, "/en/friends"],
      [s.settings, "/en/account"],
    ]);
    const form = details.querySelector("form")!;
    expect(form.getAttribute("method")).toBe("post");
    expect(form.getAttribute("action")).toBe("/auth/sign-out");
    expect((form.querySelector("input[name=locale]") as HTMLInputElement).value).toBe("en");
    expect(form.querySelector("button")?.textContent).toBe(s.signOut);
  });

  it("AC-21: with the friends flag off the Friends entry is not there", () => {
    const { details } = renderMenu({ friends: false });
    expect([...details.querySelectorAll("a")].map((a) => a.textContent)).toEqual([s.stats, s.settings]);
  });

  it("AC-24: the entry of the current page carries aria-current=page, and no other does", () => {
    pathname = "/stats";
    const { details } = renderMenu();
    const current = [...details.querySelectorAll("a[aria-current]")];
    expect(current.map((a) => [a.textContent, a.getAttribute("aria-current")])).toEqual([[s.stats, "page"]]);
  });

  it("AC-24: on a page that has no entry (the dashboard) no entry is marked", () => {
    const { details } = renderMenu();
    expect(details.querySelector("[aria-current]")).toBeNull();
  });

  it("AC-22: once hydrated the summary says whether the list is open (aria-expanded), following the details", async () => {
    const { details, summary } = renderMenu();
    expect(summary.getAttribute("aria-expanded")).toBe("false");
    await toggle(details);
    expect(summary.getAttribute("aria-expanded")).toBe("true");
    await toggle(details);
    expect(summary.getAttribute("aria-expanded")).toBe("false");
  });

  it("AC-22: Escape closes the list and puts the focus back on the button", async () => {
    const { details, summary } = renderMenu();
    await toggle(details);
    const first = details.querySelector("a")!;
    first.focus();
    await act(async () => void fireEvent.keyDown(first, { key: "Escape" }));
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);
  });

  it("AC-22: Escape on a closed menu does nothing", async () => {
    const { details, summary } = renderMenu();
    summary.focus();
    await act(async () => void fireEvent.keyDown(summary, { key: "Escape" }));
    expect(details.open).toBe(false);
  });

  it("AC-22: a click or tap outside closes it, one inside does not", async () => {
    const { details } = renderMenu();
    await toggle(details);
    await act(async () => void fireEvent.pointerDown(details.querySelector("ul")!));
    expect(details.open).toBe(true);
    await act(async () => void fireEvent.pointerDown(screen.getByRole("button", { name: "outside" })));
    await waitFor(() => expect(details.open).toBe(false));
  });

  it("AC-22: following a link closes it", async () => {
    const { details } = renderMenu();
    await toggle(details);
    const link = screen.getByRole("link", { name: s.settings });
    link.addEventListener("click", (event) => event.preventDefault()); // jsdom does not navigate
    await act(async () => void fireEvent.click(link));
    expect(details.open).toBe(false);
  });

  it("AC-22: moving to another page closes a menu that was left open (the layout stays mounted)", async () => {
    const { details, rerender } = renderMenu();
    await toggle(details);
    pathname = "/stats";
    rerender(
      <>
        <button type="button">outside</button>
        <NextIntlClientProvider locale="en" messages={messages}>
          <AccountMenu friends />
        </NextIntlClientProvider>
      </>,
    );
    await waitFor(() => expect(details.open).toBe(false));
  });
});

describe("spec 0014: the account menu before hydration", () => {
  it("AC-23: server-rendered, the list is already reachable: a closed details with the links, and no aria-expanded to contradict the browser", () => {
    const html = renderToString(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AccountMenu friends />
      </NextIntlClientProvider>,
    );
    const host = document.createElement("div");
    host.innerHTML = html;
    expect(host.querySelector("details")?.hasAttribute("open")).toBe(false);
    expect([...host.querySelectorAll("a")].map((a) => a.textContent)).toEqual([s.stats, s.friends, s.settings]);
    expect(host.querySelector("summary")?.hasAttribute("aria-expanded")).toBe(false);
    expect(host.querySelector("form[action='/auth/sign-out'][method=post]")).not.toBeNull();
  });

  it("AC-23: a tap before hydration opened the details natively: once hydrated the menu knows it is open", async () => {
    const element = (
      <NextIntlClientProvider locale="en" messages={messages}>
        <AccountMenu friends />
      </NextIntlClientProvider>
    );
    const host = document.createElement("div");
    document.body.appendChild(host);
    host.innerHTML = renderToString(element);
    host.querySelector("details")!.open = true;
    await new Promise((resolve) => setTimeout(resolve)); // the browser's own toggle, whose `toggle` event is dispatched, and unheard, before hydration starts
    let root!: Root;
    await act(async () => {
      root = hydrateRoot(host, element);
    });
    const summary = host.querySelector("summary")!;
    await waitFor(() => expect(summary.getAttribute("aria-expanded")).toBe("true"));
    await act(async () => void fireEvent.keyDown(summary, { key: "Escape" }));
    expect(host.querySelector("details")!.open).toBe(false);
    await act(async () => root.unmount());
    host.remove();
  });
});
