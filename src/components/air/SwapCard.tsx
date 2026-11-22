import { Bus, TrainFront } from "lucide-react";
import { aboutKg } from "@/domain/impact/emissions";
import type { Mode } from "@/domain/rules/modes";
import { translator, type Lang } from "@/i18n/t";
import { WhyPanel } from "./WhyPanel";

/** "One swap for the air today" (spec 7.5, 10.2 item 5b): code only, the same emissions maths as the plan. */
export function SwapCard({ mode, co2Kg, lang }: { mode: Mode; co2Kg: number; lang: Lang }) {
  const t = translator(lang);
  const metro = mode === "metro";
  const Icon = metro ? TrainFront : Bus;
  return (
    <section aria-labelledby="swap-h" className="grid gap-2 rounded-[16px] border border-brand bg-card p-4">
      <h2 id="swap-h" className="m-0 text-sm font-bold text-brand">
        {t("air.swap.title")}
      </h2>
      <p className="m-0 flex items-start gap-2.5">
        <Icon className="size-7 shrink-0 text-brand" aria-hidden="true" />
        <span>
          {t(metro ? "air.swap.metro" : "air.swap.bus")} <b>{t("air.swap.kg", { kg: aboutKg(co2Kg) })}</b> {t("air.swap.tail")}
        </span>
      </p>
      <WhyPanel lang={lang} factId={metro ? "metro_exposure" : "idling_engine"} forAir={t("air.swap.forAir", { kg: aboutKg(co2Kg) })} />
    </section>
  );
}
