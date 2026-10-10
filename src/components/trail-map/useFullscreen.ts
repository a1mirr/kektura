import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { MapHandleRef } from "./types";

export function useFullscreen(wrapper: RefObject<HTMLDivElement | null>, mapRef: MapHandleRef) {
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenRef = useRef(false);

  useEffect(() => {
    fullscreenRef.current = fullscreen;
    document.body.style.overflow = fullscreen ? "hidden" : "";
    if (fullscreen) {
      wrapper.current?.requestFullscreen?.().catch(() => {
        // not allowed or unsupported: the CSS overlay is enough
      });
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && fullscreenRef.current) setFullscreen(false);
    };
    if (fullscreen) {
      window.addEventListener("keydown", onKey);
      document.addEventListener("fullscreenchange", onFullscreenChange);
    }
    const timers = [50, 350].map((ms) => setTimeout(() => mapRef.current.map?.resize(), ms));
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      timers.forEach(clearTimeout);
      document.body.style.overflow = "";
    };
  }, [fullscreen, wrapper, mapRef]);

  const toggle = useCallback(() => setFullscreen((v) => !v), []);
  const isFullscreen = useCallback(() => fullscreenRef.current, []);
  const exit = useCallback(() => setFullscreen(false), []);
  return { fullscreen, toggle, exit, isFullscreen };
}
