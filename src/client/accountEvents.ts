/**
 * The header and the Air now card read the `bw-acct` cookie to tell a signed-in visitor apart. A
 * sign-in, a name change or a sign-out sets that cookie from a fetch, without a page load, so each
 * write announces it and the readers check the cookie again.
 */
export const ACCOUNT_CHANGED = "bw-account-changed";

/** Tells every reader to look at the cookie again. */
export function announceAccountChange(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ACCOUNT_CHANGED));
}

/** Calls `onChange` after a write here, when the tab comes back into view, or when a cookie changes. */
export function subscribeAccount(onChange: () => void): () => void {
  const store = (window as Window & { cookieStore?: EventTarget }).cookieStore;
  const onVisible = () => document.visibilityState === "visible" && onChange();
  window.addEventListener(ACCOUNT_CHANGED, onChange);
  window.addEventListener("pageshow", onChange);
  document.addEventListener("visibilitychange", onVisible);
  store?.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(ACCOUNT_CHANGED, onChange);
    window.removeEventListener("pageshow", onChange);
    document.removeEventListener("visibilitychange", onVisible);
    store?.removeEventListener("change", onChange);
  };
}
