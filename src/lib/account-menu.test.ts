import { describe, expect, it } from "vitest";
import { accountMenuEntries, isCurrentPage } from "./account-menu";

describe("spec 0014: the account menu's entries", () => {
  it("AC-21: My stats, Friends and Settings, in this order, and Settings leads to /account", () => {
    expect(accountMenuEntries({ friends: true })).toEqual([
      { key: "stats", href: "/stats" },
      { key: "friends", href: "/friends" },
      { key: "settings", href: "/account" },
    ]);
  });

  it("AC-21: while the friends flag is off the menu has no Friends entry and keeps the others in order", () => {
    expect(accountMenuEntries({ friends: false }).map((e) => e.key)).toEqual(["stats", "settings"]);
  });

  it("AC-24: the entry of the current page is found by its address, with or without a trailing slash", () => {
    expect(isCurrentPage("/stats", "/stats")).toBe(true);
    expect(isCurrentPage("/account/", "/account")).toBe(true);
    expect(isCurrentPage("/dashboard", "/stats")).toBe(false);
    expect(isCurrentPage("/", "/stats")).toBe(false);
  });

  it("AC-24: a friend's page or an invite is not the Friends list's own page", () => {
    expect(isCurrentPage("/friends", "/friends")).toBe(true);
    expect(isCurrentPage("/friends/4a1b", "/friends")).toBe(false);
    expect(isCurrentPage("/friends/invite/abc", "/friends")).toBe(false);
  });
});
