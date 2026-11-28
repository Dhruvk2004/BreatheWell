import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { translator, type Lang } from "@/i18n/t";
import { summaryRow } from "../ui/styles";

/**
 * "For adults: the numbers": a collapsed panel, the only place a public
 * view (Air now, Learn, the demo) may hold the cigarette comparison.
 */
export function ForAdults({ lang, children }: { lang: Lang; children: ReactNode }) {
  return (
    <details className="group/adults mb-3.5 rounded-[12px] bg-card-2 px-4">
      <summary className={`${summaryRow} text-[0.9375em]`}>
        {translator(lang)("adults.title")}
        <ChevronDown className="size-5 transition-transform group-open/adults:rotate-180" aria-hidden="true" />
      </summary>
      <p className="m-0 pb-3.5 text-[0.9375em]">{children}</p>
    </details>
  );
}
