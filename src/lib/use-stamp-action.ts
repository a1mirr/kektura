"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/action-result";

// Runs a stamp server action: `pending` while it runs, `failed` if it didn't go through. An expired
// session refreshes the page instead, which redirects to the sign-in screen. `optimistic` runs at the
// start of the transition, so a `useOptimistic` setter called there flips the UI at once and reverts by
// itself when the transition ends (spec 0002 AC-13).
export function useStampAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);

  const run = (action: () => Promise<ActionResult>, optimistic?: () => void) =>
    start(async () => {
      optimistic?.();
      setFailed(false);
      let result: ActionResult;
      try {
        result = await action();
      } catch {
        result = { ok: false, reason: "failed" }; // network error
      }
      if (result.ok) return;
      if (result.reason === "unauthorized") router.refresh();
      else setFailed(true);
    });

  return { pending, failed, run };
}
