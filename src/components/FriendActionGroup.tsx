"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

// `useFormStatus` only knows its own form, so while one button of the row runs the others are disabled too.
type Group = { busy: boolean; begin: () => void; end: () => void };

const GroupContext = createContext<Group | null>(null);

export const useActionGroup = () => useContext(GroupContext);

export default function FriendActionGroup({ children, className }: { children: ReactNode; className?: string }) {
  const [running, setRunning] = useState(0);
  const begin = useCallback(() => setRunning((n) => n + 1), []);
  const end = useCallback(() => setRunning((n) => n - 1), []);
  const value = useMemo(() => ({ busy: running > 0, begin, end }), [running, begin, end]);
  return (
    <GroupContext value={value}>
      <div className={className}>{children}</div>
    </GroupContext>
  );
}
