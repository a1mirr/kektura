export type AccountMenuKey = "stats" | "friends" | "settings";

export type AccountMenuEntry = {
  key: AccountMenuKey;
  href: "/stats" | "/friends" | "/account";
};

export function accountMenuEntries({ friends }: { friends: boolean }): AccountMenuEntry[] {
  return [
    { key: "stats", href: "/stats" },
    ...(friends ? [{ key: "friends", href: "/friends" } as const] : []),
    { key: "settings", href: "/account" },
  ];
}

export function isCurrentPage(pathname: string, href: string): boolean {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return clean === href;
}
