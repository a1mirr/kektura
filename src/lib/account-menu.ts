// The entries of the account menu (spec 0014 AC-20 to AC-22): which links it lists, in which order, and which of them is the
// page the visitor is on. Pure, so the order, the flag and the marking are tested without a browser.

export type AccountMenuKey = "stats" | "friends" | "settings";

export type AccountMenuEntry = {
  key: AccountMenuKey;
  /** The address without the language prefix, as `Link` from `@/i18n/navigation` takes it. */
  href: "/stats" | "/friends" | "/account";
};

// The order of the menu: My stats, Friends (only while the `friends` flag is on, spec 0024 AC-15), Settings.
export function accountMenuEntries({ friends }: { friends: boolean }): AccountMenuEntry[] {
  return [
    { key: "stats", href: "/stats" },
    ...(friends ? [{ key: "friends", href: "/friends" } as const] : []),
    { key: "settings", href: "/account" },
  ];
}

// The entry of the page the visitor is on. `pathname` is the address without the language prefix (`usePathname` of
// `@/i18n/navigation`); a trailing slash does not matter, and a sub-page (a friend's page) is not its list's page.
export function isCurrentPage(pathname: string, href: string): boolean {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return clean === href;
}
