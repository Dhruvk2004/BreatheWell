import { useSyncExternalStore } from "react";

/**
 * Whether the browser says it is online (for the offline state). Server renders and the first client
 * render assume online, so hydration never differs; the `online` / `offline` events update it.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
