import Link from "next/link";
import { t, type Lang } from "@/i18n/t";
import { btn } from "../ui/styles";

/** 404: bilingual, the page language first, with two ways out. */
export function NotFound({ lang }: { lang: Lang }) {
  const other: Lang = lang === "en" ? "hi" : "en";
  return (
    <section className="grid gap-4">
      <h1 className="m-0 text-2xl font-bold">{t(lang, "notFound.title")}</h1>
      <p lang={other} className="m-0 text-lg">
        {t(other, "notFound.title")}
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/air" className={btn.primary}>
          {t(lang, "notFound.air")} · <span lang={other}>{t(other, "notFound.air")}</span>
        </Link>
        <Link href="/" className={btn.secondary}>
          {t(lang, "notFound.home")} · <span lang={other}>{t(other, "notFound.home")}</span>
        </Link>
      </div>
    </section>
  );
}
