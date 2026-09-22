import { useEffect, useRef } from "react";

export function useRefreshOnFocus(refresh: () => void, throttleMs = 15_000) {
  const lastRun = useRef(Date.now());

  useEffect(() => {
    const run = () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastRun.current < throttleMs) return;
      lastRun.current = now;
      refresh();
    };
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", run);
    return () => {
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", run);
    };
  }, [refresh, throttleMs]);
}
