"use client";

import { ExternalLink } from "lucide-react";
import { openInChromeHref } from "@/client/inAppBrowser";
import { t, type Lang } from "@/i18n/t";
import { CopyButton } from "../ui/CopyButton";
import { btn } from "../ui/styles";

/**
 * Opened inside WhatsApp, Instagram or another in-app browser: Google blocks
 * sign-in there, so the page offers Open in Chrome and Copy link, in English and Hindi, and never
 * starts a sign-in.
 */
export function InAppScreen({ lang, href, userAgent }: { lang: Lang; href: string; userAgent: string }) {
  const other: Lang = lang === "en" ? "hi" : "en";
  return (
    <section aria-labelledby="inapp-h" className="grid gap-4">
      <h1 id="inapp-h" className="m-0 text-2xl font-bold">
        {t(lang, "auth.inApp.title")}
      </h1>
      <p className="m-0">{t(lang, "auth.inApp.body")}</p>
      <p className="m-0" lang={other}>
        {t(other, "auth.inApp.body")}
      </p>
      <a href={openInChromeHref(href, userAgent)} className={btn.primary}>
        <ExternalLink className="size-5" aria-hidden="true" />
        {t(lang, "auth.inApp.open")} · <span lang={other}>{t(other, "auth.inApp.open")}</span>
      </a>
      <CopyButton text={href} label={t(lang, "auth.inApp.copy")} done={t(lang, "auth.inApp.copied")} failed={t(lang, "share.copyFailed")} />
      <p className="m-0 text-sm text-ink-muted">{t(lang, "auth.inApp.hint")}</p>
    </section>
  );
}
