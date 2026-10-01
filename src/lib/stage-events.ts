// Stage sections of the stamps list listen for this to open/close (also used when a click on
// the map needs to reveal a row inside a collapsed stage).
export const STAGE_EVENT = "kektura:stage";

export type StageEventDetail = { stage: number | "all"; open: boolean };

export function setStageOpen(stage: number | "all", open: boolean) {
  window.dispatchEvent(new CustomEvent<StageEventDetail>(STAGE_EVENT, { detail: { stage, open } }));
}
