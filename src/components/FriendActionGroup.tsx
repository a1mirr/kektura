"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

// The buttons of one row of the Friends page (approve and ignore of one request, sharing and remove of one friend)
// share one busy state: `useFormStatus` only knows its own form, so while one of them runs the others of the row
// are disabled too (spec 0024 AC-17).
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
