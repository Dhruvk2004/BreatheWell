import { ChevronDown } from "lucide-react";
import type { BreezyCard } from "@/domain/breezy/answer";
import { factById } from "@/domain/impact/facts";
import { formatTime, parseHhMm } from "@/domain/time/format";
import { translator, type Lang } from "@/i18n/t";

type Picture = NonNullable<BreezyCard["picture"]>;

/**
 * "Why?" on an adult's Breezy card with an activity and a time (spec 7.7.3): the code-made "Picture
 * it" (less smoke than at the day's smokiest hour, and the whole-day cigarette figure for adults),
 * then the fact's numbers. Gemini never writes any of it; a dependent's card never gets it.
 */
export function PicturePanel({ picture, factId, lang }: { picture: Picture; factId: string | null; lang: Lang }) {
  const t = translator(lang);
  const than = parseHhMm(picture.thanTime);
  const fact = factId ? factById(factId) : undefined;
  const { dayOutside } = picture;
  return (
    <details className="group">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-[0.9375em] font-bold text-brand [&::-webkit-details-marker]:hidden">
        {t("why.open")}
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <dl className="m-0 grid gap-2 border-l-[3px] border-brand py-0.5 pl-3.5 text-[0.9375em]">
        <div>
          <dt className="font-bold">{t("why.pictureIt")}</dt>
          {picture.lessPercent > 0 && (
            <dd className="m-0">{t("breezy.picture.less", { percent: picture.lessPercent, time: formatTime(than.hour, 0, lang) })}</dd>
          )}
          <dd className="m-0">
            {dayOutside.lessThanOne ? t("breezy.picture.adultsLess") : t("breezy.picture.adults", { count: dayOutside.count })}
          </dd>
        </div>
        {fact && (
          <div>
            <dt className="font-bold">{t("why.numbers")}</dt>
            <dd className="m-0">
              {fact.level3[lang]}{" "}
              <a href={fact.source.url} className="text-brand underline" rel="noopener noreferrer" target="_blank">
                {fact.source.name}
              </a>
            </dd>
          </div>
        )}
      </dl>
    </details>
  );
}
