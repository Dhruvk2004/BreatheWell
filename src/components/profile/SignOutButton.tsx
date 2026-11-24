"use client";

import { LogOut } from "lucide-react";
import { btn } from "../ui/styles";
import { useGoTo } from "./useGoTo";

/**
 * Sign out: the server revokes the session and clears the cookies; then home. The header shows this
 * on every page, so the sign-out code (and Zod with it) loads only when the button is pressed.
 */
export function SignOutButton({ label, className = `${btn.secondary} w-max` }: { label: string; className?: string }) {
  const goTo = useGoTo();
  return (
    <button
      type="button"
      onClick={async () => {
        const { signOut } = await import("@/client/auth");
        await signOut();
        goTo("/");
      }}
      className={className}
    >
      <LogOut className="size-5" aria-hidden="true" />
      {label}
    </button>
  );
}
