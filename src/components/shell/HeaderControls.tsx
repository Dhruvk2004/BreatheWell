"use client";

import { switchLanguage } from "@/components/prefs/language";
import { translator, type Lang } from "@/i18n/t";

const CONTROL = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm px-3 font-bold text-brand hover:bg-brand-tint";

/**
 * The language switch (design header pattern), the only client component in the shell.
 * The language button shows the other language in its own script ("हिंदी" on English screens) so
 * Dadaji can find it without reading English.
 */
export function HeaderControls({ lang }: { lang: Lang }) {
  const t = translator(lang);
  const other = lang === "en" ? "hi" : "en";
  return (
    <div className="flex items-center gap-1">
      {/* The visible language name stays part of the accessible name (WCAG 2.5.3 label in name). */}
      <button type="button" className={CONTROL} onClick={() => switchLanguage(other)}>
        <span className="sr-only">{t("shell.lang.switchLabel")}: </span>
        <span lang={other}>{t("shell.lang.switch")}</span>
      </button>
    </div>
  );
}
