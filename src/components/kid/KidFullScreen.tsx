"use client";

import { Maximize2, X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { btn } from "../ui/styles";

interface KidFullScreenProps {
  readonly openLabel: string;
  readonly closeLabel: string;
  readonly title: string;
  readonly lang: string;
  readonly children: ReactNode;
}

/**
 * "Show full screen" (design F): a native modal dialog with big text for the child at the door.
 * `showModal()` traps focus; Close (or Escape) returns focus to the button.
 */
export function KidFullScreen({ openLabel, closeLabel, title, lang, children }: KidFullScreenProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const close = () => dialog.current?.close();
  return (
    <>
      <button ref={opener} type="button" onClick={() => dialog.current?.showModal()} className={`${btn.primary} col-span-full`}>
        <Maximize2 className="size-5" aria-hidden="true" />
        {openLabel}
      </button>
      <dialog
        ref={dialog}
        aria-label={title}
        onClose={() => opener.current?.focus()}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-card p-0 text-ink backdrop:bg-[var(--color-scrim)]"
      >
        <div lang={lang} className="relative grid min-h-full content-center justify-items-center gap-4 px-6 pt-16 pb-8 text-center">
          <button type="button" onClick={close} autoFocus className={`${btn.secondary} ${btn.small} absolute top-4 right-4`}>
            <X className="size-5" aria-hidden="true" />
            {closeLabel}
          </button>
          {children}
        </div>
      </dialog>
    </>
  );
}
