import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { translator, type Lang } from "@/i18n/t";
import type { KidPage } from "@/view/demoPage";
import { demoHref } from "@/data/demo/query";
import { DemoBanner } from "../demo/DemoNotes";
import { btn, sourceLine } from "../ui/styles";
import { KidCardView } from "./KidCardView";

/** The demo kid card page: banner, back to the sample family, the card and its share text. */
export function KidView({ kid, lang }: { kid: KidPage; lang: Lang }) {
  const t = translator(lang);
  return (
    <div className="grid gap-4">
      <DemoBanner lang={lang} />
      <Link href={demoHref(kid.data.query)} className={`${btn.text} w-max`}>
        <ChevronLeft className="size-5" aria-hidden="true" />
        {t("demo.back")}
      </Link>
      <KidCardView kid={{ ...kid, name: kid.person.name[lang] }} lang={lang} pageLang={lang} />
      <p className={sourceLine}>
        {t("kid.shareLabel")} <span>{kid.shareText}</span>
      </p>
    </div>
  );
}
