import type { Verdict } from "@/domain/rules/verdict";
import { verdictKey } from "@/i18n/labels";
import { translator, type Lang } from "@/i18n/t";
import { VERDICT_STYLE } from "../ui/bandStyle";
import { VerdictGlyph } from "../ui/icons";

/** Go / Go with care / Avoid: icon + word in a tinted pill (design D). The rules decide it; this only shows it. */
export function VerdictChip({ verdict, lang }: { verdict: Verdict; lang: Lang }) {
  return (
    <span
      className={`inline-flex w-max items-center gap-1.5 rounded-pill border-[1.5px] border-current py-0.5 pr-3 pl-2 text-[0.9375em] leading-snug font-bold whitespace-nowrap ${VERDICT_STYLE[verdict]}`}
    >
      <VerdictGlyph verdict={verdict} />
      {translator(lang)(verdictKey(verdict))}
    </span>
  );
}
