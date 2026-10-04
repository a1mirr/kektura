import type { LineStyle } from "@/lib/compare-map";

// A short sample of a map line, drawn the way the map draws it, so a legend does not rely on colour alone.
const border: Record<LineStyle, string> = {
  solid: "4px solid",
  dashed: "4px dashed",
  dotted: "4px dotted",
  faint: "2px solid",
  todo: "3px dashed",
};

export default function CompareSwatch({ style, color }: { style: LineStyle; color: string }) {
  return <span aria-hidden="true" className="inline-block w-6 shrink-0" style={{ borderTop: `${border[style]} ${color}` }} />;
}
