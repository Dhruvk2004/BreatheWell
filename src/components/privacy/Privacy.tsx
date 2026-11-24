import { translator, type Lang } from "@/i18n/t";
import { h2 } from "../ui/styles";
import { PrivacyTables } from "./PrivacyTables";

/** Plain-words sections, in order. */
const SECTIONS = ["store", "dont", "adults", "gemini", "location", "delete", "sources"] as const;

/** Privacy page: what we store and don't, who sees what, Gemini, location, retention. */
export function Privacy({ lang }: { lang: Lang }) {
  const t = translator(lang);
  return (
    <article className="grid max-w-[44rem] gap-5">
      <header className="grid gap-1">
        <h1 className="m-0 text-2xl font-bold">{t("privacy.title")}</h1>
        <p className="m-0 text-sm text-ink-muted">{t("privacy.updated")}</p>
      </header>
      {SECTIONS.map((key) => (
        <section key={key} aria-labelledby={`privacy-${key}`} className="grid gap-1.5">
          <h2 id={`privacy-${key}`} className={h2}>
            {t(`privacy.${key}.title`)}
          </h2>
          <p className="m-0">{t(`privacy.${key}.body`)}</p>
        </section>
      ))}
      <PrivacyTables lang={lang} />
    </article>
  );
}
