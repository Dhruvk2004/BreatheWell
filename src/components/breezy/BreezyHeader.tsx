import { translator, type Lang } from "@/i18n/t";
import { BreezyMark } from "./BreezyMark";

/** "Breezy uses today's air for Green Park, 7:00 am" (always shown). */
export function BreezyHeader({ lang, title, uses }: { lang: Lang; title: string; uses: string }) {
  const t = translator(lang);
  return (
    <header className="flex items-start gap-3">
      <BreezyMark />
      <div className="grid gap-0.5">
        <h1 className="m-0 text-2xl font-bold">{title}</h1>
        <p className="m-0 text-sm text-ink-muted">{uses}</p>
        <p className="m-0 text-sm">{t("breezy.tagline")}</p>
      </div>
    </header>
  );
}
