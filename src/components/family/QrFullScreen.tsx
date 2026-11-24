"use client";

import { Maximize2, X } from "lucide-react";
import { useRef } from "react";
import { translator, type Lang } from "@/i18n/t";
import { btn } from "../ui/styles";
import { QrCode } from "./QrCode";

interface Props {
  readonly link: string;
  readonly code: string;
  readonly validTill: string;
  readonly familyName: string;
  readonly lang: Lang;
}

/** QR full screen: for pointing Dadaji's camera at it across the table; Close returns focus. */
export function QrFullScreen({ link, code, validTill, familyName, lang }: Props) {
  const t = translator(lang);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const title = t("invite.scanTitle", { family: familyName });
  return (
    <>
      <button ref={opener} type="button" onClick={() => dialog.current?.showModal()} className={`${btn.secondary} w-full`}>
        <Maximize2 className="size-5" aria-hidden="true" />
        {t("invite.fullScreen")}
      </button>
      <dialog
        ref={dialog}
        aria-label={title}
        onClose={() => opener.current?.focus()}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-card p-0 text-ink"
      >
        <div className="relative grid min-h-full content-center justify-items-center gap-4 px-6 pt-16 pb-8 text-center">
          <button
            type="button"
            autoFocus
            onClick={() => dialog.current?.close()}
            className={`${btn.secondary} ${btn.small} absolute top-4 right-4`}
          >
            <X className="size-5" aria-hidden="true" />
            {t("invite.close")}
          </button>
          <p className="m-0 text-2xl font-bold">{title}</p>
          <QrCode link={link} label={t("invite.qrAlt")} className="w-[min(80vw,24rem)]" />
          <p className="m-0 font-mono text-3xl font-bold" lang="en">
            {code}
          </p>
          <p className="m-0 text-ink-muted">{t("invite.valid", { time: validTill })}</p>
        </div>
      </dialog>
    </>
  );
}
