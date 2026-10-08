# 0014: Footer pages, the header strip with the account menu, and the settings page

Status: Done
Owner code: `src/components/Footer.tsx`, `src/app/[locale]/(pages)/*`, `src/app/[locale]/account/*`,
`src/components/SignOutButton.tsx`, `src/components/SiteLogo.tsx`, `src/components/HeaderControls.tsx`, `src/components/AccountMenu.tsx`,
`src/lib/account-menu.ts`, `public/logo.svg`, `src/app/[locale]/layout.tsx` (the strip), `next.config.ts` (the
`/settings` redirect), `supabase/migrations/0008_pages_settings.sql`, `messages/*.json` (`account.*`,
`accountMenu.*`, `app.name`, `app.home`)

## Goal

Footer navigation to the informational pages (About, Changelog, Useful links, Feedback), a settings page for
signed-in users that holds everything about the account: signing out and deleting the account (the stamps-per-month chart
lives on the stats page, spec 0037), and one header strip on every page: the site logo, a way home that never needs the footer, with
the language dropdown and, for a signed-in visitor, one "Account" button at its right. The button opens a short menu to the
pages of the signed-in area (My stats, Friends, Settings), so no page carries a row of links of its own (a friend's page keeps one link back to the Friends list), which matters most on a phone.

## Behaviour

### Footer navigation

- **AC-1**: Every page has a footer with links to About, Changelog, Useful links and Feedback, in the
  page's language. The footer links only to pages anyone can open; the settings page is reached from
  the account menu (AC-21), because a footer link would lead signed-out visitors nowhere. Full-height
  pages (the error page) fill the space above the footer instead of a whole screen, so the footer stays on the first screen. The
  landing page's footer follows its gallery of screenshots, below the first screen (spec 0038 AC-7).

### Informational pages

- **AC-2**: `/about` tells what the app is, how progress is counted, where the data comes from and what
  happens to the user's data (spec 0015).
- **AC-3**: `/changelog` lists what changed and when, newest first (spec 0018).
- **AC-4**: `/links` lists useful links for the trail, grouped (spec 0019).

### Feedback form

- **AC-5**: `/feedback` has a form to send a message to the developer (spec 0017).
- **AC-6**: A submitted message is stored in `user_feedback` and delivered to the developer (spec 0017).

### Settings page

- **AC-7**: `/account` is the settings page. It is for signed-in users; a signed-out visitor is sent to the landing page. The
  account menu has a "Settings" entry to it (AC-21).
- **AC-8**: Removed. The "Stamps per month" chart moved to the stats page (spec 0037); `/account` has none.
- **AC-9**: "Delete account" asks for confirmation first ("Are you sure? This cannot be undone." with a
  confirm button and a cancel link). Confirming permanently deletes the account with all its stamps and
  extra stamps, signs the user out and returns to the landing page. Cancelling changes nothing.
- **AC-10**: Feedback the user sent before stays, but is no longer linked to them
  (`user_feedback.user_id` becomes null).
- **AC-11**: When deleting fails (the server refuses or isn't reachable) the page says so in the user's
  language, next to the button, which can be used again; nothing is deleted. When the session has
  expired the page refreshes, which sends the user to the landing page. No browser `alert()`.
- **AC-12**: A user can only delete their own account: `delete_user_account()` works on `auth.uid()`
  and can't be executed by anonymous callers.
- **AC-13**: The delete action never throws: it returns an `ActionResult` (`ok`, `unauthorized` or
  `failed`) and logs a failure as one `[account-delete]` line without secrets (spec 0008's rules).
- **AC-14**: A page's own title row has no navigation of its own: the dashboard's header is its title alone, with no language dropdown and no links to
  "My stats", "Friends" or the settings page, which are the header strip's (AC-20, AC-21), and the stats, settings and Friends pages have none either. The one exception is a friend's page (spec 0024 AC-22), whose title row keeps a single link, "Friends", back to the list: it is the way back from a page the menu does not list, and it is the only link in that row.
- **AC-15**: The page's document title and `h1` are "Settings" (`ru`: Настройки, `hu`: Beállítások, `de`: Einstellungen); its address stays `/account`. The address `/settings`, in any language prefix,
  redirects (307, in `next.config.ts`, so before the proxy and without a session) to `/account` in the same
  language, so open tabs and old links don't end on a 404.
- **AC-16**: The settings page has a "Sign out" button (`ru`: Выйти, `hu`: Kijelentkezés, `de`: Abmelden) next to its heading. It
  behaves as spec 0005 AC-6 says: a plain form POST to `/auth/sign-out` that revokes the session, clears the
  cookies and returns to the landing page in the current locale. Afterwards the dashboard and the settings page send
  the visitor to the landing page. The button is a touch target at least 44 px high.
- **AC-17**: Signing out from the settings page works with JavaScript off (the button is a plain form, not a client
  component).
- **AC-18**: The page, the account menu (its button, its entries and its sign-out button) and the settings page's button are translated in every language, and the About page
  (spec 0015) calls the page by its name, "Settings", in its "Your data" text and links to `/account`. The menu's entry, the page's document title
  and `h1` and that text use one word.

### Site logo and header strip

- **AC-19**: Every page shows the logo, a blue trail blaze, with the name next to it ("Kéktúra tracker",
  `ru`: Трекер Kéktúra, `hu`: Kéktúra követő) at the left edge of the page's content width (spec 0036 AC-1), and it links to the main page of the page's
  language (`/ru`, `/en`, `/hu`): for a signed-in user that leads to the dashboard (spec 0005 AC-2), for everybody
  else the landing page. "Every page" is the landing page, dashboard, account, stats, friends pages, About, Changelog,
  Useful links, Feedback, the error page and the 404 page, which has no language in its address and so links
  to the default language's main page. It is one component, `SiteLogo`, the header strip, drawn once by the locale layout (with the controls of AC-20 as its children) and by the 404
  page (which brings its own document, and draws it alone): a page does not draw its own, so a new page gets it. It is a link
  named "Kéktúra tracker: home" (translated, containing the visible name), with a visible keyboard focus ring and a
  touch target of at least 44 x 44 px; the mark itself is decorative (empty `alt`). It sits in normal flow above the
  page content, below the test server banner, and the pages still fit 375 px without sideways scrolling; the map's
  fullscreen view (spec 0003 AC-11), which is positioned, covers it because the logo is not. The mark is the single file `public/logo.svg`, loaded from the site itself. Pages keep
  their own title rows, and the About and friends pages have no "back to the tracker" link of their own.
- **AC-20**: The header strip also carries, at its right edge, the language dropdown (spec 0005 AC-10) on every page but the 404 page, and for a signed-in visitor
  one button, "Account" (`ru`: Аккаунт, `hu`: Fiók, `de`: Konto), that opens the account menu (AC-21). It is the only account entry of a page: there are no
  separate "My stats", "Friends" or "Account" links. The strip, the dropdown and the button are drawn once, by the locale layout (`HeaderControls` inside `SiteLogo`), never by a
  page. A signed-out visitor gets the dropdown and no button; the 404 page, which has no language prefix, no language provider and no session, shows the logo alone.
  The strip lies inside the page width (spec 0036 AC-1) and fits 375 px in every language without sideways scrolling: when the controls do not fit beside the
  logo they wrap onto a second row, still at the right edge. The button follows the session of each request: after signing out or deleting the account no page shows it.
- **AC-21**: The account menu lists three links in this order, each to its page in the page's language: "My stats" (`ru`: Моя статистика, `hu`: Statisztikáim, `de`: Meine Statistik) to `/stats`
  (spec 0037 AC-1), "Friends" (`ru`: Друзья, `hu`: Barátok, `de`: Freunde) to `/friends` (spec 0024), and "Settings" to `/account` (AC-15). "Friends" is in the menu only while the
  `friends` flag is on for the viewer (spec 0024 AC-15, read on every request: spec 0035), so with the flag off there are two entries. Below the links is "Sign out" (AC-26).
  The order and the flag are one pure function, `accountMenuEntries` (`src/lib/account-menu.ts`).
- **AC-22**: The menu is a disclosure, not an application menu: a `<details>` whose `<summary>` is the button, with an accessible name, and an open list of plain links (no
  `role="menu"`). A click or tap and Enter or Space open and close it. With JavaScript the button also carries `aria-expanded`, Escape closes the list and returns the focus to
  the button, a click or tap outside the menu closes it, following a link closes it, and moving to another page closes a menu that was left open (the layout stays mounted
  between pages). Tab moves through the entries in order, Sign out last.
- **AC-23**: Without JavaScript, or before the page has hydrated, the menu still opens and its entries and Sign out work: they are a `<details>`, links and a plain form. What AC-22 adds beyond opening
  is an enhancement. A tap made before hydration is not lost: the menu takes its state from the element when it hydrates.
- **AC-24**: The entry of the page the visitor is on is marked: `aria-current="page"` and visibly (bold, a blue bar and a tint). A page that has no entry (the dashboard, a friend's page)
  marks none; a friend's page is not the Friends list's own page.
- **AC-25**: On a desktop window the list hangs under the button, right-aligned to it, at least 200 px wide and never wider than the window; on a phone (375 px) it stays inside the
  window with no sideways scrolling. The button and every entry, Sign out included, are at least 44 px high, and the button at least 44 px wide. Over the page, the list covers the
  dashboard's sticky map column; the map's fullscreen view still covers the strip, because the strip is not positioned.
- **AC-26**: "Sign out" in the menu behaves like the settings page's button (AC-16, spec 0005 AC-6): a plain form POST to `/auth/sign-out` with the page's language, which revokes the
  session, clears the cookies and returns to the landing page, with JavaScript off too. The settings page keeps its own button.
- **AC-27**: The strip reads the session with `getUser()` and the `friends` flag on every request (never from a build), so every page under the language prefix renders per
  request, About, Changelog, Useful links and Feedback included. A signed-out visitor costs neither a flag lookup nor a database read for the strip.

## Out of scope

Breadcrumbs, a menu for signed-out visitors, a badge or count on the account button (pending friend requests), an avatar, the language dropdown inside the menu, a favicon or app icons (spec 0015 AC-6); other settings (language, email, export of the data); a "type your email to confirm" step; showing the signed-in
email on the page.

## Notes

- Deleting needs a database function with elevated rights (`security definer`), because a user can't
  delete their own row in `auth.users` through the API. The stamps follow through `on delete cascade`.
- Supabase's advisor flags `delete_user_account()` as a WARN ("signed-in users can execute a SECURITY
  DEFINER function"). That is intended: a signed-in user must be able to call it, and it only ever deletes
  `auth.uid()`'s own row; anonymous callers can't run it (tested). The alternative, deleting through the
  Auth admin API, would put the `service_role` key (full access to everything) into the app server's
  environment, which is the bigger risk.
- After the deletion the user's session no longer exists at the Auth server, so `signOut()` gets a
  401/403 back; supabase-js ignores that and still clears the session cookies.
- The message namespace of the page is `account` (`title`, `signOut`, ...) and of the menu `accountMenu` (`label`, `stats`, `friends`, `settings`, `signOut`). The
  `[account-delete]` log line, the `delete_user_account` function and the address `/account` keep their names from when the page was called "account"; `/settings` redirects to it.
- The menu's button says "Account" and not the user's display name, because the display name is edited on the Friends page, which is behind a flag.
- `HeaderControls` is a Server Component: it decides the `friends` flag per request and passes a boolean to the client component `AccountMenu`, which needs script only for AC-22's
  extras. Deleting the account ends in a navigation that re-renders the strip (the server action clears the cookies), which `e2e/account.spec.ts` checks.

## Coverage

| AC | Test |
| --- | --- |
| AC-1 | `e2e/footer.spec.ts` (four links on a public page and on the dashboard, none for the settings page; the link texts of every language: `e2e/languages.spec.ts`; the landing page's footer follows its gallery: `e2e/landing.spec.ts`, spec 0038 AC-7) |
| AC-2 | spec 0015 |
| AC-3, AC-4 | specs 0018, 0019 |
| AC-5, AC-6 | spec 0017 |
| AC-7, AC-15 | `e2e/account.spec.ts` (redirect when signed out; the menu leads to the page; title and heading "Settings"; `/settings` redirects to `/account`; in each language: `e2e/languages.spec.ts`) |
| AC-14 | `e2e/account-menu.spec.ts` (the dashboard's, stats and settings pages' title rows have no links and the dashboard's is its heading alone), `tests/account-menu.test.ts` (no page file links to `/stats`, `/account` or `/friends` from its header, and none draws a switcher or menu; a friend's page has exactly one link in its title row, to `/friends`, and no other) |
| AC-8 | Removed (the chart is spec 0037's; `e2e/account.spec.ts` checks that `/account` and the dashboard have none) |
| AC-9, AC-10 | `e2e/account.spec.ts` (cancel; delete: account, stamps and extra stamps gone, feedback kept and unlinked, signed out and no account button on the page it ends on, signing in again gives an empty account), `src/app/[locale]/account/DeleteAccountButton.test.tsx` |
| AC-11 | `DeleteAccountButton.test.tsx`, `e2e/account.spec.ts` (server action answering 500) |
| AC-12 | `e2e/feedback.spec.ts` (anonymous caller refused); migration 0008 |
| AC-13 | `src/app/[locale]/account/actions.test.ts`, `src/lib/log.test.ts` |
| AC-16 | `e2e/account.spec.ts` (the button sits next to the heading; sign out from the settings page, then dashboard and account redirect; in each language: `e2e/languages.spec.ts`), `e2e/auth.spec.ts`, `e2e/mobile.spec.ts` (at 375 px the button is at least 44 px high and signs out when tapped) |
| AC-17 | `e2e/account.spec.ts` (with JavaScript disabled) |
| AC-18 | `tests/messages.test.ts` (the menu entry, the page title and the About page's link text use one name, "Settings", in each language; the button says Account and not the page's name; Sign out has the same words in the menu and on the page; no old header-link keys), `e2e/languages.spec.ts` (the menu's button, entries and Sign out, the page title and the sign-out button in every language), `e2e/about.spec.ts` (link) |
| AC-19 | `tests/site-logo.test.ts` (one component, drawn only by the locale layout and the 404 page, which also covers the error page: the layout wraps its boundary; the SVG is local; empty `alt`; translated names; no back-link keys left), `e2e/site-logo.spec.ts` (every public and signed-in page: link, address, accessible name, 44 px target, at the content's left edge, no overflow at 375 px, focus ring, banner above it, every language, the 404 page) |
| AC-20 | `e2e/account-menu.spec.ts` (one button on every signed-in page, the strip's one link while it is closed, the dropdown left of the button on one row, a signed-out visitor and the 404 page), `tests/account-menu.test.ts` (the layout draws the controls inside the strip, the 404 page the logo alone, and nothing else draws them), `e2e/layout.spec.ts` (the dropdown and the button end at the content's right edge, at five widths), `e2e/account.spec.ts` (no button after deleting the account), `e2e/mobile.spec.ts` (the strip at 375 px in every language) |
| AC-21 | `src/lib/account-menu.test.ts` (the order, the flag), `src/components/AccountMenu.test.tsx` (links, addresses, form), `e2e/account-menu.spec.ts` (the list and addresses, each entry leads to its page), `e2e/feature-flags.spec.ts` (the Friends entry in each state of the flag), `e2e/languages.spec.ts` (every language), `e2e/stats.spec.ts`, `e2e/friends.spec.ts` |
| AC-22 | `src/components/AccountMenu.test.tsx` (details and summary, no menu roles, `aria-expanded`, Escape and focus, outside click, link, page change), `e2e/account-menu.spec.ts` (Enter and Space, Tab order, Escape returns the focus, outside click, a followed link, native open state, no menu roles), `e2e/accessibility.spec.ts` (axe with the list open, both widths) |
| AC-23 | `e2e/account-menu.spec.ts` (JavaScript off: the entries open, lead to their pages, mark the current one, Sign out signs out), `src/components/AccountMenu.test.tsx` (the server's HTML: closed, links, form, no `aria-expanded`; a tap before hydration is adopted) |
| AC-24 | `src/lib/account-menu.test.ts` (current page, trailing slash, sub-pages), `src/components/AccountMenu.test.tsx`, `e2e/account-menu.spec.ts` (the marked entry on three pages and none on the dashboard, only it bold) |
| AC-25 | `e2e/account-menu.spec.ts` (1440, 1024 and 768 px: under the button, right-aligned, at least 200 px, inside the window, 44 px targets; a click at each entry's centre hits it above the dashboard's map column; the fullscreen map covers the button), `e2e/mobile.spec.ts` (375 px in every language: inside the window, 200 px, 44 px targets, no sideways scroll), `e2e/accessibility.spec.ts` (target sizes, both widths) |
| AC-26 | `e2e/account-menu.spec.ts` (the menu's Sign out, with JavaScript off too), `e2e/auth.spec.ts`, `e2e/mobile.spec.ts` (tap), `src/components/AccountMenu.test.tsx` (the form) |
| AC-27 | `tests/account-menu.test.ts` (`getUser`, never `getClaims`; the flag only for a signed-in visitor; no service role), `e2e/feature-flags.spec.ts` (a change of the flag shows on the next request), the button is on the About, Changelog, Useful links and Feedback pages for a signed-in visitor: `e2e/account-menu.spec.ts`. The strip's reads add a Supabase call per page view for a signed-in visitor, in parallel with the page's own: not measured |
