export default function MovedNote({ children }: { children: string }) {
  return (
    <p data-moved-note className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900 [overflow-wrap:anywhere]">
      {children}
    </p>
  );
}
