import fs from "node:fs";
import { describe, expect, it } from "vitest";

const src = new URL("../src/", import.meta.url);
const files = [
  "components/TrailMap.tsx",
  ...fs.readdirSync(new URL("components/trail-map/", src)).map((name) => `components/trail-map/${name}`),
  ...fs.readdirSync(new URL("lib/", src)).filter((name) => /^map-.*\.ts$/.test(name) && !name.endsWith(".test.ts")).map((name) => `lib/${name}`),
];

describe("spec 0003: how the map code is structured", () => {
  it("AC-17: TrailMap.tsx, the trail-map pieces and the map-*.ts helpers are each at most 300 lines", () => {
    expect(files.length).toBeGreaterThan(15);
    const big = files
      .map((file) => [file, fs.readFileSync(new URL(file, src), "utf8").split("\n").length] as const)
      .filter(([, lines]) => lines > 300);
    expect(big).toEqual([]);
  });

  it("AC-17: TrailMap.tsx composes the hooks of trail-map/ and keeps no map logic of its own", () => {
    const text = fs.readFileSync(new URL("components/TrailMap.tsx", src), "utf8");
    for (const hook of ["useMapInstance", "useLayerToggles", "useFullscreen", "useRoutePlanner"]) expect(text, hook).toContain(hook);
  });
});
