import { ChevronDown } from "lucide-react";
import type { PollutantValue } from "@/domain/air/pollutants";
import type { CigaretteFigure } from "@/domain/impact/cigarettes";
import { translator, type Lang } from "@/i18n/t";
import { accordion, summaryRow } from "../ui/styles";
import { ForAdults } from "./ForAdults";

/**
 * Pollutant details (spec 10.2 item 7), collapsed. Inside it, the collapsed "For adults: the
 * numbers" panel is the only place a public page shows the cigarette comparison (spec 6.4 🔒).
 */
export function PollutantDetails({
  values,
  cigarettes,
  lang,
}: {
  values: readonly PollutantValue[];
  cigarettes: CigaretteFigure | null;
  lang: Lang;
}) {
  const t = translator(lang);
  return (
    <details className={`group ${accordion}`}>
      <summary className={summaryRow}>
        {t("air.pollutants.title")}
        <ChevronDown className="size-5 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1 pb-3.5 text-[0.9375em]">
        {values.map((v) => (
          <div key={v.pollutant} className="contents">
            <dt className="font-bold">{t(`air.pollutant.${v.pollutant}`)}</dt>
            <dd className="m-0">
              {v.value} {v.unit}
              {isMain(v.pollutant) && ` · ${t(`air.main.${v.pollutant}`)}`}
            </dd>
          </div>
        ))}
      </dl>
      {cigarettes && <ForAdults lang={lang}>{dayCigaretteText(cigarettes, lang)}</ForAdults>}
    </details>
  );
}

/** PM2.5 and PM10 drive the AQI here, so their rows say which of them is the main pollutant. */
const isMain = (p: PollutantValue["pollutant"]): p is "pm25" | "pm10" => p === "pm25" || p === "pm10";

/** The whole day outside today, as cigarettes (Berkeley Earth; whole days only, always "about"). */
function dayCigaretteText(cigarettes: CigaretteFigure, lang: Lang): string {
  const t = translator(lang);
  const count = cigarettes.lessThanOne ? t("adults.lessThanOne") : String(cigarettes.count);
  return `${t("adults.cigarettes", { count })} ${t("adults.method")}`;
}
