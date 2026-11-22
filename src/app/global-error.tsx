"use client";

import { useParams } from "next/navigation";
import { ErrorPanel } from "@/components/system/ErrorPanel";
import { langOf, t } from "@/i18n/t";
import "./globals.css";

/**
 * Last-resort boundary for errors in the root layout itself (spec 10.17): it replaces the layout, so
 * it brings its own document, and keeps the bilingual "Your data is safe." panel.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  const lang = langOf(useParams()?.lang);
  return (
    <html lang={lang} data-text="md">
      <body className="flex min-h-dvh flex-col">
        <title>{t(lang, "error.title")}</title>
        <main className="mx-auto w-full max-w-[60rem] px-4 py-8">
          <ErrorPanel lang={lang} onRetry={retry} />
        </main>
      </body>
    </html>
  );
}
