# 0036: Page layout: one width, shared edges, reading columns

Status: Done
Owner code: `src/components/PageShell.tsx`, `src/app/globals.css` (`--page-width`, `.map-box`), `src/components/SiteLogo.tsx`,
`src/components/Footer.tsx`, `src/app/[locale]/layout.tsx`, every page under `src/app/[locale]/`, `src/app/not-found.tsx`

## Goal

On a desktop screen a page looks designed instead of a narrow strip in the middle of an empty window: the header strip with
the logo, the page content and the footer share one width and one pair of edges, long reads keep a comfortable line, and the
pages that are made of independent blocks put them side by side (the dashboard, spec 0001 AC-28, and the friends pages, spec
0024 AC-27 and AC-28). On a phone the layout is one column. The narrowest width it promises is 375 px.

## Behaviour

### Width and edges

- **AC-1**: The header strip (the logo, spec 0014 AC-19), the page content and the footer share one content width, 64 rem
  (1024 px), and one pair of edges. The logo sits at that left edge, so on a window wider than 64 rem it is never at the window's
  edge. A page's own header (the title row of the dashboard, the account page and a friend's page, with the language switcher and
  links) lies inside the same width. Below 64 rem the width is the window's.
- **AC-2**: One component, `PageShell`, sets the content width, the side padding and the vertical rhythm of a page, so a new page
  gets them without remembering them: every page file draws its page with it and has no `<main>`, `mx-auto` or `max-w-*` container
  of its own. The width is one value, 64 rem, in the CSS variable `--page-width` (`globals.css`), taken by the shell, the logo
  strip and the footer, so they cannot disagree. Content fills the window minus the side padding below that width (16 px up to
  640 px, 24 px above) and is centred at it above.
- **AC-3**: The pages that are a long read (About, Changelog, Useful links, Feedback, and the text blocks of the account page)
  keep a line of about 65 characters (`65ch`): a text column centred inside the content width. Cards, the map, charts and stage
  lists use the full width.
- **AC-4**: The landing page, the error page and the 404 page keep a centred block (at most 42 rem wide) that fills the space
  above the footer; the invite page (spec 0024) is one centred card (at most 28 rem). None of them gets an empty wide column.

### Narrow and wide screens

- **AC-5**: A page never scrolls sideways at 375, 768, 1024, 1440 and 1920 px, in every language, signed in and signed out. Below
  1024 px every page is one column, in the order of the blocks in the page; 375 px is the narrowest width the layout promises (a
  page may still work on a narrower screen, but nothing is promised or guarded).
- **AC-6**: Full-height pages (landing, error, 404) fill the space above the footer with `flex-1`, never `min-h-screen`, so the
  footer stays on the first screen at any width.

## Out of scope

Colours, fonts and the look of cards; a sidebar or other navigation; the account menu; a dark theme; a layout for very wide screens
that shows more of the same content instead of centring it.

## Notes

- A wide page made of independent blocks gives `PageShell` an `aside` (left column), its children (right column) and a `header`
  above both. The columns start at 1024 px (`lg`), where the content is 976 px wide, 5 : 7. Below it the DOM order (header, aside,
  children) is the order on the screen.
- The page width is spelled out once: a test fails if `64rem` or `max-w-5xl` appears in another source file.

## Coverage

| AC | Test |
| --- | --- |
| AC-1 | `e2e/layout.spec.ts` (the logo strip, the page and the footer: same width and left edge, centred, the logo's mark at the content edge, at 375, 768, 1024, 1440 and 1920 px on the public pages and signed in, and the dashboard's own header and language switcher inside it), `e2e/site-logo.spec.ts` (the logo at the content's left edge) |
| AC-2 | `tests/page-shell.test.ts` (every page file uses `PageShell` and has no container of its own; the width is one 64 rem variable taken by the shell, the logo strip and the footer; the paddings), `src/components/PageShell.test.tsx` (every variant is one `<main>` with the shared width) |
| AC-3 | `e2e/layout.spec.ts` (the column is `65ch` wide and centred on the four pages; the account page's text, not its cards), `src/components/PageShell.test.tsx` |
| AC-4 | `e2e/layout.spec.ts` (the landing page, the 404 page and the invite page at 1920 px), `src/components/PageShell.test.tsx` |
| AC-5 | `e2e/layout.spec.ts` (no sideways scroll at the five widths on every page, in English and in the other languages; one column below 1024 px: the dashboard, a friend's page and the Friends page) |
| AC-6 | `e2e/layout.spec.ts` (the landing page's footer is on the first screen at every width), `src/components/PageShell.test.tsx` (`flex-1`, no `min-h-screen`), `e2e/footer.spec.ts` |
