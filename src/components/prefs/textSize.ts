import { useSyncExternalStore } from "react";
import { isTextSize, PREF_COOKIES, prefCookie, type TextSize } from "./cookies";

/**
 * The text size lives on `<html data-text>` (set before paint from the cookie) and is read from there,
 * so the server renders "md" and the client agrees after hydration without a mismatch.
 */
const listeners = new Set<() => void>();

const read = (): TextSize => {
  const value = document.documentElement.getAttribute("data-text");
  return isTextSize(value) ? value : "md";
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Applies and saves a text size, and tells every reader. */
export function setTextSize(size: TextSize): void {
  document.documentElement.setAttribute("data-text", size);
  document.cookie = prefCookie(PREF_COOKIES.textSize, size, location.protocol === "https:");
  listeners.forEach((listener) => listener());
}

/** The current text size ("md" on the server). */
export const useTextSize = (): TextSize => useSyncExternalStore(subscribe, read, () => "md");
