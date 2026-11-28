import { tipById, type TipId } from "@/domain/libraries/tips";
import { formatHour } from "@/domain/time/format";
import { translator, type Lang } from "@/i18n/t";
import type { Words } from "@/view/app";
import { h2 } from "../ui/styles";
import { WhyPanel } from "./WhyPanel";

/** A tip's text with its airing time filled in by code. */
export const tipText = (id: TipId, airOutAt: number | null, lang: Lang): string =>
  tipById(id).text[lang].replace("{time}", airOutAt === null ? "" : formatHour(airOutAt, lang));

/**
 * "At home today": three numbered tips from the tips library, each
 * with Why?; on Today a tip shows the family plan's wording when Gemini's passed the checks.
 */
export function TipList({
  tips,
  airOutAt,
  lang,
  headingId,
  words = {},
}: {
  tips: readonly TipId[];
  airOutAt: number | null;
  lang: Lang;
  headingId: string;
  words?: Readonly<Record<string, Words>>;
}) {
  const t = translator(lang);
  return (
    <section aria-labelledby={headingId} className="grid gap-2">
      <h2 id={headingId} className={h2}>
        {t("air.home.title")}
      </h2>
      <ol className="m-0 list-none rounded-[16px] border border-rule bg-card px-4 py-0">
        {tips.map((id, i) => (
          <li key={id} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-rule py-3 first:border-t-0">
            <span className="grid size-7 place-items-center rounded-full bg-brand-tint text-sm font-bold text-brand" aria-hidden="true">
              {i + 1}
            </span>
            <span>
              {words[id]?.doThis ?? tipText(id, airOutAt, lang)}
              <WhyPanel lang={lang} factId={tipById(id).factId} picture={words[id]?.why} />
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
