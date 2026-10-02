import { useEffect, useRef } from "react";

// A ref that always holds the value of the latest committed render, for callbacks that outlive it
// (map event handlers, timers).
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
