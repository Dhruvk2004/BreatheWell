import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { translator, type Lang } from "@/i18n/t";
import type { KidCardPage } from "@/view/app";
import { btn, noteInfo, sourceLine } from "../ui/styles";
import { KidCardView } from "./KidCardView";

/** A family dependent's kid card: the card speaks the card language; the buttons follow the viewer's. */
export function FamilyKidView({ page, lang }: { page: KidCardPage; lang: Lang }) {
  const t = translator(lang);
  return (
    <div className="grid gap-4">
      <Link href="/today" className={`${btn.text} w-max`}>
        <ChevronLeft className="size-5" aria-hidden="true" />
        {t("kid.back")}
      </Link>
      {page.kid ? (
        <>
          <KidCardView kid={page.kid} lang={page.lang} pageLang={lang} />
          <p className={sourceLine}>
            {t("kid.shareLabel")} <span lang={page.lang}>{page.kid.shareText}</span>
          </p>
        </>
      ) : (
        <>
          <h1 className="m-0 text-2xl font-bold">{translator(page.lang)("kid.title", { name: page.person.name })}</h1>
          <p className={`m-0 ${noteInfo}`}>{t("kid.noAir")}</p>
        </>
      )}
    </div>
  );
}
