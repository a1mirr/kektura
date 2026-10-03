// The official description of each stamp at a place (spec 0001 AC-10): shown in full, wrapping onto as
// many lines as it needs. Never `truncate`: the text says where the stamp box is, so a cut-off one is
// useless.
export default function StampDescriptions({ descriptions }: { descriptions: (string | null)[] }) {
  return descriptions.map((d, i) => (
    <div key={i} className="text-xs break-words text-stone-500">
      {d}
    </div>
  ));
}
