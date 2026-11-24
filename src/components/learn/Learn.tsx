import { cigarettesPerDay } from "@/domain/impact/cigarettes";
import { aboutKg, airNowSwap } from "@/domain/impact/emissions";
import { EXAMPLE_DAY_PM25, topActions } from "@/domain/impact/topActions";
import { translator, type Lang } from "@/i18n/t";
import { ForAdults } from "../air/ForAdults";
import { WhyPanel } from "../air/WhyPanel";
import { AboutNumbers } from "./AboutNumbers";
import { Section } from "./Section";
import { YourChoices } from "./YourChoices";
import type { YourDay } from "@/domain/impact/yourDay";

/**
 * Learn: for a signed-in adult, "Your choices today" first; then the top
 * actions with their three levels, the picture, how we decide and our numbers. In the generic view
 * the cigarette comparison sits only in the collapsed "For adults: the numbers" panel (spec 6.4 🔒).
 */
export function Learn({ lang, yourDay }: { lang: Lang; yourDay?: YourDay | null }) {
  const t = translator(lang);
  const example = cigarettesPerDay(EXAMPLE_DAY_PM25).count;
  return (
    <div className="grid gap-5">
      <h1 className="m-0 text-2xl font-bold">{t("learn.title")}</h1>
      {yourDay ? <YourChoices day={yourDay} lang={lang} /> : <p className="m-0 text-[0.9375em] text-ink-muted">{t("learn.signIn")}</p>}
      <TopActions lang={lang} />
      <Section title={t("learn.picture.title")} open>
        <p className="m-0">{t("learn.picture.body")}</p>
        <ForAdults lang={lang}>{t("learn.picture.adults", { pm: EXAMPLE_DAY_PM25, count: example })}</ForAdults>
      </Section>
      <Section title={t("learn.decide.title")}>
        <p className="m-0">{t("learn.decide.rules")}</p>
        <p className="m-0">{t("learn.decide.trips")}</p>
        <p className="m-0">{t("learn.decide.winter")}</p>
      </Section>
      <AboutNumbers lang={lang} />
    </div>
  );
}

/** The top five actions in rank order (domain/impact/topActions), each with Do this · Picture it · The numbers. */
function TopActions({ lang }: { lang: Lang }) {
  const t = translator(lang);
  const swapKg = aboutKg(airNowSwap(true).avoided.co2Kg);
  return (
    <ol className="m-0 list-none rounded-[16px] border border-rule bg-card px-4 py-0">
      {topActions().map(({ id, factId }, i) => (
        <li key={id} className="grid grid-cols-[auto_1fr] gap-x-3 border-t border-rule py-3 first:border-t-0">
          <span className="grid size-7 place-items-center rounded-full bg-brand-tint text-sm font-bold text-brand" aria-hidden="true">
            {i + 1}
          </span>
          <span>
            <b>{t(`learn.top.${id}`)}</b>
            <WhyPanel lang={lang} factId={factId} forAir={factId === "metro_exposure" ? t("learn.metroAir", { kg: swapKg }) : undefined} />
          </span>
        </li>
      ))}
    </ol>
  );
}
