"use client";

import { useSyncExternalStore } from "react";

const noSubscription = () => () => {};

export const useHydrated = () => useSyncExternalStore(noSubscription, () => true, () => false);
