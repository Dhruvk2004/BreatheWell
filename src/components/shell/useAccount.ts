import { useSyncExternalStore } from "react";
import { subscribeAccount } from "@/client/accountEvents";

/** The `bw-acct` cookie holds only initials ("NS"), set with the session (src/server/auth/cookies.ts). */
export function accountInitials(cookie: string): string | null {
  const match = /(?:^|;\s*)bw-acct=([^;]*)/.exec(cookie);
  const value = match ? decodeURIComponent(match[1]) : "";
  return /^\p{L}{1,2}$/u.test(value) ? value : null;
}

/**
 * The signed-in visitor's initials, or null. Static pages render signed out on the server and
 * switch after hydration; the value follows sign-in and sign-out without a reload.
 */
export function useAccountInitials(): string | null {
  return useSyncExternalStore(
    subscribeAccount,
    () => accountInitials(document.cookie),
    () => null,
  );
}
