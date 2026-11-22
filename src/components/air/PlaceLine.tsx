import Link from "next/link";
import { MapPin } from "lucide-react";
import { translator, type Lang } from "@/i18n/t";
import { btn } from "../ui/styles";

/** "Green Park, New Delhi · Change" and the page's one h1 (visually hidden, design 10.2). */
export function PlaceLine({ name, lang }: { name: string; lang: Lang }) {
  const t = translator(lang);
  return (
    <>
      <p className="m-0 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-bold">
          <MapPin className="size-5 shrink-0 text-brand" aria-hidden="true" />
          {name}
        </span>
        <Link href="/#place-search" className={btn.text}>
          {t("air.change")}
          <span className="sr-only"> {t("air.changeLabel")}</span>
        </Link>
      </p>
      <h1 className="sr-only">{t("air.titleAt", { place: name })}</h1>
    </>
  );
}
