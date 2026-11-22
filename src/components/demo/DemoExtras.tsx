import Link from "next/link";
import { Users, Wind } from "lucide-react";
import { alternativeById } from "@/domain/libraries/alternatives";
import { aboutKg } from "@/domain/impact/emissions";
import type { TogetherAction } from "@/domain/family/familyDay";
import { formatInstant } from "@/domain/time/instant";
import { translator, type Lang } from "@/i18n/t";
import type { Words } from "@/view/app";
import { aiLine, btn, h2, sourceLine } from "../ui/styles";

/** "Help the air" (spec 10.8 item 4): one together action, in the plan's words when Gemini's passed. */
export function HelpTheAir({ action, lang, words = null }: { action: TogetherAction; lang: Lang; words?: Words | null }) {
  const t = translator(lang);
  const alt = alternativeById(action);
  return (
    <section aria-labelledby="help-h" className="grid gap-2.5 rounded-[16px] bg-brand-tint p-4">
      <h2 id="help-h" className={`${h2} flex items-center gap-2`}>
        <Users className="size-5 text-brand" aria-hidden="true" />
        {t("demo.helpAir")}
      </h2>
      <p className="m-0">{words?.doThis ?? alt?.doThis[lang]}</p>
      <p className="m-0 text-[0.9375em]">{alt?.forAir[lang]}</p>
    </section>
  );
}

interface WeekLineProps {
  readonly week: { readonly co2Kg: number; readonly carTrips: number };
  readonly lang: Lang;
  readonly family?: boolean;
  /** With an id, the line gets its "This week" heading (Today, design 10.8 item 4a). */
  readonly headingId?: string;
}

/**
 * "This week the family avoided about 7 kg CO₂ and 3 car trips." (F21) from ticked swaps. Today
 * says it in the family's voice, and invites the first tick while the week is still empty.
 */
export function WeekLine({ week, lang, family = false, headingId }: WeekLineProps) {
  const t = translator(lang);
  const empty = family && week.co2Kg <= 0 && week.carTrips === 0;
  const vars = { kg: aboutKg(week.co2Kg), trips: week.carTrips };
  const line = (
    <p className="m-0 rounded-[16px] border border-rule bg-card p-4 text-[0.9375em]">
      {empty ? t("today.weekNone") : t(family ? "today.week" : "demo.week", vars)}
    </p>
  );
  if (!headingId) return line;
  return (
    <section aria-labelledby={headingId} className="grid gap-2">
      <h2 id={headingId} className={h2}>
        {t("today.weekTitle")}
      </h2>
      {line}
    </section>
  );
}

/** Breezy demo entry (spec 10.3 item 5); the demo chat itself arrives with Breezy. */
export function BreezyEntry({ lang }: { lang: Lang }) {
  return (
    <Link href="/demo/ask" className={`${btn.secondary} w-full`}>
      <Wind className="size-5" aria-hidden="true" />
      {translator(lang)("demo.breezy")}
    </Link>
  );
}

interface SourceLineProps {
  readonly at: Date;
  readonly timeZone: string;
  readonly lang: Lang;
  /** The demo's stored plan: "stored" while its words show, "later" at 12 pm and 4 pm. */
  readonly stored?: "stored" | "later" | null;
}

/**
 * The demo's source line and the fixed caption under the rows (design G, 10.3, spec 11.6):
 * "Made by BreatheWell assistant (Google Gemini), stored for this 6 am" in Monsoon blue only while
 * stored Gemini words show; otherwise "Simple plan".
 */
export function PlanSourceLine({ at, timeZone, lang, stored = null }: SourceLineProps) {
  const t = translator(lang);
  return (
    <div className="grid min-h-8 gap-1">
      {stored === "stored" ? (
        <p className={aiLine}>
          <Wind className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t("plan.storedDemo")}
        </p>
      ) : (
        <p className={sourceLine}>
          {stored === "later" ? t("plan.demoLater") : t("demo.simplePlan", { time: formatInstant(at, timeZone, lang) })}
        </p>
      )}
      <p className={sourceLine}>{t("demo.rulesCaption")}</p>
    </div>
  );
}
