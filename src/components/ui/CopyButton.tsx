"use client";

import { Copy } from "lucide-react";
import { useState } from "react";
import { btn } from "./styles";

interface CopyButtonProps {
  readonly text: string;
  readonly label: string;
  /** Said in a polite live region after copying ("Copied. Paste it in WhatsApp."). */
  readonly done: string;
  readonly failed: string;
  readonly className?: string;
  /** A fuller accessible name when the visible label alone is ambiguous ("Remind Rahul"). */
  readonly ariaLabel?: string;
}

/** Copies a share text and says so in a live region (no timed auto-dismiss for errors). */
export function CopyButton({ text, label, done, failed, className = "", ariaLabel }: CopyButtonProps) {
  const [status, setStatus] = useState("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(done);
    } catch {
      setStatus(failed);
    }
  };
  return (
    <>
      <button type="button" onClick={copy} aria-label={ariaLabel} className={`${btn.secondary} ${btn.small} ${className}`}>
        <Copy className="size-5" aria-hidden="true" />
        {label}
      </button>
      <span role="status" className="text-sm empty:hidden">
        {status}
      </span>
    </>
  );
}
