import { setStageOpen } from "@/lib/stage-events";

// "Show in list" (spec 0003 AC-12): scroll the matching list row (`place-<key>` / `extra-<id>`) into
// view and flash it.
export function revealInList(kind: string, key: string) {
  const el = document.getElementById(`${kind}-${key}`);
  if (!el) return;
  // Rows of a collapsed stage are hidden: open the stage first, then scroll once it has laid out.
  const stage = el.dataset.stage;
  if (stage) setStageOpen(Number(stage), true);
  setTimeout(
    () => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("flash");
      void el.offsetWidth; // restart the animation
      el.classList.add("flash");
    },
    stage ? 80 : 0,
  );
}
