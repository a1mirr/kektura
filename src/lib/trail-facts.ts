// Computed from the MTSZ stage table (scripts/data/okt-stages.json) so it can't drift from the data the rest of the
// app uses.
import stagesData from "../../scripts/data/okt-stages.json";

type StageRow = { km: number; places: readonly unknown[] };

export type TrailFacts = { stages: number; places: number; km: number };

export function trailFacts(stages: readonly StageRow[]): TrailFacts {
  const km = stages.reduce((sum, s) => sum + s.km, 0);
  return {
    stages: stages.length,
    places: stages.reduce((sum, s) => sum + s.places.length, 0),
    km: Math.round(km * 10) / 10, // 0.1 km steps: sums of table values carry float noise
  };
}

export const TRAIL_FACTS = trailFacts(stagesData.stages);
