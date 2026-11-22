import type { CigaretteFigure } from "@/domain/impact/cigarettes";
import { aboutKg } from "@/domain/impact/emissions";
import type { YourDay } from "@/domain/impact/yourDay";
import { translator, type Lang } from "@/i18n/t";
import { h2 } from "../ui/styles";

const figure = (f: CigaretteFigure, lang: Lang): string =>
  f.lessThanOne ? translator(lang)("learn.you.lessThanOne") : translator(lang)("learn.you.count", { count: f.count });

/**
 * "Your choices today" (spec 10.11 item 1, design 10.11 signed-in): outside all day against the day
 * with the plan, in whole-day cigarettes (adults only, signed in), and the CO₂ avoided for the air.
 */
export function YourChoices({ day, lang }: { day: YourDay; lang: Lang }) {
  const t = translator(lang);
  return (
    <section aria-labelledby="you-h" className="grid gap-3 rounded-[16px] border border-rule bg-card p-4">
      <h2 id="you-h" className={h2}>
        {t("learn.you.title")}
      </h2>
      <dl className="m-0 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[12px] bg-card-2 p-3">
          <dt className="text-sm text-ink-muted">{t("learn.you.outside")}</dt>
          <dd className="m-0 text-xl font-bold">{figure(day.outside, lang)}</dd>
        </div>
        <div className="rounded-[12px] bg-brand-tint p-3">
          <dt className="text-sm text-ink-muted">{t("learn.you.withPlan")}</dt>
          <dd className="m-0 text-xl font-bold">{figure(day.withPlan, lang)}</dd>
        </div>
      </dl>
      <p className="m-0 text-sm text-ink-muted">{t("learn.you.method")}</p>
      {day.co2Kg > 0 && <p className="m-0">{t("learn.you.air", { kg: aboutKg(day.co2Kg) })}</p>}
    </section>
  );
}
