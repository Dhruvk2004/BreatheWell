import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { factById } from "@/domain/impact/facts";
import { translator, type Lang } from "@/i18n/t";

interface WhyPanelProps {
  readonly lang: Lang;
  readonly factId: string;
  /** Level 1 "Do this", when it is not the line the panel hangs under. */
  readonly doThis?: string;
  /** Extra level-2 lines, e.g. "For the air: about 2 kg less CO₂". */
  readonly forAir?: ReactNode;
  /** Level 2 in the assistant's words (Gemini `why`); the fact's own text otherwise. */
  readonly picture?: string;
}

/**
 * "Why?": Do this · Picture it · The numbers, from the facts library
 * (code only). Public pages never show a cigarette line here (that lives only in "For adults").
 */
export function WhyPanel({ lang, factId, doThis, forAir, picture }: WhyPanelProps) {
  const t = translator(lang);
  const fact = factById(factId);
  if (!fact) return null;
  return (
    <details className="group">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-[0.9375em] font-bold text-brand [&::-webkit-details-marker]:hidden">
        {t("why.open")}
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <dl className="m-0 grid gap-2 border-l-[3px] border-brand py-0.5 pl-3.5 text-[0.9375em]">
        {doThis && <Level term={t("why.doThis")}>{doThis}</Level>}
        <Level term={t("why.pictureIt")}>
          {picture ?? fact.text[lang]}
          {forAir && <span className="mt-1 block">{forAir}</span>}
        </Level>
        <Level term={t("why.numbers")}>
          {fact.level3[lang]}{" "}
          <a href={fact.source.url} className="text-brand underline" rel="noopener noreferrer" target="_blank">
            {fact.source.name}
          </a>
        </Level>
      </dl>
    </details>
  );
}

function Level({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-bold">{term}</dt>
      <dd className="m-0">{children}</dd>
    </div>
  );
}
