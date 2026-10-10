"use client";

import { useSyncExternalStore } from "react";

const noSubscription = () => () => {};

// For controls that only work with JavaScript and so must not be offered without it.
export const useHydrated = () => useSyncExternalStore(noSubscription, () => true, () => false);
