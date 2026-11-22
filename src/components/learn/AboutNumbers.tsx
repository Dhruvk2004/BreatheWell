import { EMISSION_FACTORS } from "@/domain/impact/emissionFactors";
import { factById, type Fact } from "@/domain/impact/facts";
import type { Mode } from "@/domain/rules/modes";
import { modeKey } from "@/i18n/labels";
import { translator, type Lang } from "@/i18n/t";
import { Section } from "./Section";

const FACTS = ["aqi_method", "pm_standards", "model_vs_station"] as const;
const MODES: readonly Mode[] = ["car", "two_wheeler", "auto_bus", "school_bus", "metro", "cycle"];

/** "About our numbers" (spec 10.11 item 5): method, standards, the model caveat and the emission factors with sources. */
export function AboutNumbers({ lang }: { lang: Lang }) {
  const t = translator(lang);
  return (
    <Section id="numbers" title={t("learn.numbers.title")}>
      {FACTS.map((id) => factById(id))
        .filter((fact): fact is Fact => fact !== undefined)
        .map((fact) => (
          <p key={fact.id} className="m-0">
            {fact.level3[lang]}{" "}
            <a href={fact.source.url} className="text-brand underline" rel="noopener noreferrer" target="_blank">
              {fact.source.name}
            </a>
          </p>
        ))}
      <FactorsTable lang={lang} />
      <p className="m-0 text-sm text-ink-muted">{t("learn.numbers.estimates")}</p>
    </Section>
  );
}

/** CO₂ per passenger-km by mode, from `emissionFactors.ts` (the same numbers every swap uses). */
function FactorsTable({ lang }: { lang: Lang }) {
  const t = translator(lang);
  return (
    <table className="w-full border-collapse text-left">
      <caption className="pb-1 text-left font-bold">{t("learn.numbers.factors")}</caption>
      <thead>
        <tr className="border-b border-rule-strong">
          <th scope="col" className="py-1.5 pr-3">
            {t("learn.numbers.mode")}
          </th>
          <th scope="col" className="py-1.5">
            {t("learn.numbers.co2")}
          </th>
        </tr>
      </thead>
      <tbody>
        {MODES.map((mode) => (
          <tr key={mode} className="border-b border-rule">
            <th scope="row" className="py-1.5 pr-3 font-normal">
              {t(modeKey(mode))}
            </th>
            <td className="py-1.5 tabular-nums">{EMISSION_FACTORS[mode].co2KgPerPkm}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
