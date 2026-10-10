export const STAGE_EVENT = "kektura:stage";

export type StageEventDetail = { stage: number | "all"; open: boolean };

export function setStageOpen(stage: number | "all", open: boolean) {
  window.dispatchEvent(new CustomEvent<StageEventDetail>(STAGE_EVENT, { detail: { stage, open } }));
}
