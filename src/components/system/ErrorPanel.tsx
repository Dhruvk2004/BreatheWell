"use client";

import { t, type Lang } from "@/i18n/t";
import { btn } from "../ui/styles";

/** The error boundary's content: bilingual "Your data is safe." first, then Try again. */
export function ErrorPanel({ lang, onRetry }: { lang: Lang; onRetry: () => void }) {
  const other: Lang = lang === "en" ? "hi" : "en";
  return (
    <section role="alert" className="grid gap-4">
      <h1 className="m-0 text-2xl font-bold">{t(lang, "error.title")}</h1>
      <p lang={other} className="m-0 text-lg">
        {t(other, "error.title")}
      </p>
      <button type="button" onClick={onRetry} className={`${btn.primary} w-fit`}>
        {t(lang, "error.retry")} · <span lang={other}>{t(other, "error.retry")}</span>
      </button>
    </section>
  );
}
