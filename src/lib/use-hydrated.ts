"use client";

import { useSyncExternalStore } from "react";

const noSubscription = () => () => {};

// False in the server's HTML and during hydration, true once the page runs in the browser. For controls that only work with
// JavaScript and so must not be offered without it (spec 0016 AC-14).
export const useHydrated = () => useSyncExternalStore(noSubscription, () => true, () => false);
