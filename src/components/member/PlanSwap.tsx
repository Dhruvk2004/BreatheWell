import { ArrowLeftRight } from "lucide-react";
import { aboutKg, avoidedBySwap } from "@/domain/impact/emissions";
import { alternativeById } from "@/domain/libraries/alternatives";
import type { TripLength } from "@/domain/rules/activities";
import type { Mode } from "@/domain/rules/modes";
import { translator, type Lang } from "@/i18n/t";
import type { PlanSwapView } from "@/view/app";
import { SWAP_KEY } from "@/domain/impact/progress";
import { WhyPanel } from "../air/WhyPanel";
import { pictureFor } from "./PlanItems";
import { TickBox } from "./TickBox";

interface PlanSwapProps {
  readonly swap: PlanSwapView;
  /** Whose plan this is, and today's ticked keys: a done swap counts toward the weekly line. */
  readonly forId: string;
  readonly ticked: readonly string[];
  readonly travel: { readonly main: Mode; readonly tripLength: TripLength };
  readonly lang: Lang;
}

/**
 * The plan's "Swap" card: one low-emission alternative code allowed, in the
 * plan's words when Gemini's passed, with "For you" and "For the air" from the library and the
 * emissions maths (code only).
 */
export function PlanSwap({ swap, forId, ticked, travel, lang }: PlanSwapProps) {
  const t = translator(lang);
  const alt = alternativeById(swap.altId);
  if (!alt) return null;
  const forAir = alt.to
    ? t("member.forAirKg", { kg: aboutKg(avoidedBySwap(travel.main, alt.to, travel.tripLength).co2Kg) })
    : t("member.forAir", { text: alt.forAir[lang] });
  return (
    <section aria-labelledby="plan-swap-h" className="grid gap-2 rounded-[16px] border border-brand bg-card p-4">
      <h2 id="plan-swap-h" className="m-0 flex items-center gap-2 text-sm font-bold text-brand">
        <ArrowLeftRight className="size-5" aria-hidden="true" />
        {t("member.swap")}
      </h2>
      <p className="m-0 text-lg">{swap.words?.doThis ?? alt.doThis[lang]}</p>
      <p className="m-0 text-[0.9375em]">{t("member.forYou", { text: alt.forYou[lang] })}</p>
      <p className="m-0 text-[0.9375em]">{forAir}</p>
      <WhyPanel lang={lang} factId={alt.factId} picture={pictureFor(swap.words ?? undefined, alt.factId)} />
      <TickBox
        target={{ kind: "plan", forId, key: `${SWAP_KEY}${alt.id}` }}
        label={t("member.swapDone")}
        done={ticked.includes(`${SWAP_KEY}${alt.id}`)}
        lang={lang}
      />
    </section>
  );
}
