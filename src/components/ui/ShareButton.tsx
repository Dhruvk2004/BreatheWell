"use client";

import { Share2 } from "lucide-react";
import { useSyncExternalStore } from "react";
import { btn } from "./styles";

const noSubscription = () => () => {};
const canShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

/**
 * The system share sheet (Web Share), shown only where the browser has one; the
 * WhatsApp link and Copy stay as the fallback. Closing the sheet without sharing is not an error.
 */
export function ShareButton({ text, label }: { text: string; label: string }) {
  const available = useSyncExternalStore(noSubscription, canShare, () => false);
  if (!available) return null;
  const share = () => navigator.share({ text }).catch(() => undefined);
  return (
    <button type="button" onClick={share} className={`${btn.secondary} ${btn.small}`}>
      <Share2 className="size-5" aria-hidden="true" />
      {label}
    </button>
  );
}
