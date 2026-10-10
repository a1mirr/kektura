import type { ReactNode } from "react";

export const pageWidth = "mx-auto w-full max-w-(--page-width) px-4 sm:px-6";

export type PageVariant = "wide" | "reading" | "hero" | "card";

export default function PageShell({
  variant = "wide",
  spaced = false,
  header,
  aside,
  stretch = false,
  below,
  children,
}: {
  variant?: PageVariant;
  spaced?: boolean;
  header?: ReactNode;
  aside?: ReactNode;
  stretch?: boolean;
  below?: ReactNode;
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
      <main
        data-page={variant}
        className={`${pageWidth} flex flex-1 flex-col items-center py-8 text-center ${below ? "gap-12" : "justify-center"}`}
      >
        <div className="flex w-full max-w-2xl flex-col items-center gap-6">{children}</div>
        {below}
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
