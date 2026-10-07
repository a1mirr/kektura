import type { ReactNode } from "react";

// The width, the side padding and the vertical rhythm of every page (spec 0036 AC-1, AC-2). The header strip with the
// logo, the page and the footer all take `pageWidth`, so their edges cannot disagree: below `--page-width` (globals.css,
// 64 rem) the content fills the window minus the padding (16 px up to 640 px, 24 px above), above it the box is centred.
export const pageWidth = "mx-auto w-full max-w-(--page-width) px-4 sm:px-6";

export type PageVariant = "wide" | "reading" | "hero" | "card";

// `wide`: the whole width, for pages made of cards, a map, charts and lists. `reading`: a long read, a text column of about 65
// characters centred in it (AC-3). `hero`: a centred block that fills the space above the footer with flex-1, not
// min-h-screen (the landing, error and 404 pages, AC-4). `card`: one centred card (the invite page, AC-4).
// `spaced` puts a gap between the page's blocks.
//
// A wide page made of independent blocks gives `aside` (the left column) next to its children (the right one) and
// `header` (the title row, above both): from 1024 px they stand side by side, below it they are one column in the DOM's
// order, header, aside, children (spec 0001 AC-28, spec 0024 AC-27, AC-28). `stretch` makes the aside as tall as the
// children, so that a block inside it can stick (`lg:sticky`) and stay in view while they scroll: the dashboard's map, spec 0001
// AC-28. A sticky box is a stacking context of its own, so it takes a z-index (`lg:z-10`) that lifts it, and the fullscreen map
// (`fixed z-50`) inside it, over the positioned controls of the children (the date fields, spec 0003 AC-11).
export default function PageShell({
  variant = "wide",
  spaced = false,
  header,
  aside,
  stretch = false,
  children,
}: {
  variant?: PageVariant;
  spaced?: boolean;
  header?: ReactNode;
  aside?: ReactNode;
  stretch?: boolean;
  children: ReactNode;
}) {
  const gap = spaced ? " space-y-8" : "";

  if (variant === "reading") {
    return (
      <main data-page={variant} className={`${pageWidth} py-8`}>
        <div className={`mx-auto max-w-prose${gap}`}>{children}</div>
      </main>
    );
  }
  if (variant === "hero") {
    return (
      <main data-page={variant} className={`${pageWidth} flex flex-1 flex-col items-center justify-center py-8 text-center`}>
        <div className="flex w-full max-w-2xl flex-col items-center gap-6">{children}</div>
      </main>
    );
  }
  if (variant === "card") {
    return (
      <main data-page={variant} className={`${pageWidth} py-8`}>
        <div className="mx-auto mt-8 max-w-md space-y-6 rounded-xl border p-6 text-center">{children}</div>
      </main>
    );
  }
  if (aside) {
    return (
      <main data-page="split" className={`${pageWidth} space-y-8 py-8`}>
        {header}
        <div className={`space-y-8 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8 lg:space-y-0${stretch ? "" : " lg:items-start"}`}>
          <div data-page-aside className="space-y-8">
            {aside}
          </div>
          <div className="space-y-8">{children}</div>
        </div>
      </main>
    );
  }
  return (
    <main data-page={variant} className={`${pageWidth} py-8${gap}`}>
      {children}
    </main>
  );
}
