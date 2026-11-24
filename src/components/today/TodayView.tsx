import Link from "next/link";
import { Megaphone, Plus, Users, Wind } from "lucide-react";
import { MAX_DEPENDENTS } from "@/domain/family/caps";
import { formatInstant } from "@/domain/time/instant";
import { translator, type Lang } from "@/i18n/t";
import type { AirView, TodayPage } from "@/view/app";
import { NoDataCard, OldDataNote, SafeAnyway, StationNote } from "../air/AirStates";
import { BandCard } from "../air/BandCard";
import { BestLine } from "../air/BestLine";
import { DaySection } from "../air/DaySection";
import { TipList } from "../air/TipList";
import { HelpTheAir, WeekLine } from "../demo/DemoExtras";
import { SevereNote } from "../demo/DemoNotes";
import { PlanSlot } from "../plan/PlanSlot";
import { RememberPlan } from "../plan/RememberPlan";
import { btn, h2, noteInfo } from "../ui/styles";
import { JoinCard } from "./JoinCard";
import { removalOf } from "./removal";
import { savedPlanOf } from "./savedPlanOf";
import { ShareToday } from "./ShareToday";
import { TodayRows } from "./TodayRows";

/**
 * Today: the answer first from code, the family rows, the admin's join
 * cards, Add a child or teen, Share today's plan, At home today, Help the air, this week and the
 * 5 days. Rows, tips and Help the air show the Gemini plan's words where they passed the checks;
 * the slot under "Your family today" says which ("Made by BreatheWell assistant" or "Simple plan").
 */
export function TodayView({ page, appOrigin, lang }: { page: TodayPage; appOrigin: string; lang: Lang }) {
  const t = translator(lang);
  const { family, air } = page;
  const day = air.setupVerdict !== null ? air.day : null;
  const dependents = family.people.filter((p) => p.kind === "dependent").length;
  const saved = savedPlanOf(page, lang);
  return (
    <div className="grid gap-5">
      {saved && <RememberPlan plan={saved} />}
      <h1 className="m-0 text-2xl font-bold">{t("today.title", { place: family.placeName })}</h1>
      <TodayAir air={air} lang={lang} />
      {page.joinCards.map((j) => (
        <JoinCard key={j.uid} member={removalOf(family, j.uid)} lang={lang} />
      ))}
      <FamilySection page={page} day={day} appOrigin={appOrigin} lang={lang} />
      {!day && <SafeAnyway lang={lang} />}
      <FamilyActions alone={family.people.length === 1} canAdd={dependents < MAX_DEPENDENTS} isAdmin={family.isAdmin} lang={lang} />
      {page.shareText && <ShareToday text={page.shareText} lang={lang} />}
      {day && day.homeTips.length > 0 && (
        <TipList tips={day.homeTips} airOutAt={day.airOutAt} lang={lang} headingId="today-home-h" words={page.words.home} />
      )}
      {day && <HelpTheAir action={day.together} lang={lang} words={page.words.together} />}
      <TodayLinks communityHref={page.communityHref} lang={lang} />
      <WeekLine week={page.week} lang={lang} family headingId="today-week-h" />
      {air.day && <DaySection days={air.day.summary.outlook} lang={lang} headingId="today-days-h" showBest />}
    </div>
  );
}

/** "Your family today": the plan slot (badge, then source line) and the rows, or "No plan" without air. */
function FamilySection({ page, day, appOrigin, lang }: { page: TodayPage; day: AirView["day"]; appOrigin: string; lang: Lang }) {
  const t = translator(lang);
  const { family, air } = page;
  return (
    <section aria-labelledby="family-h" className="grid gap-2">
      <h2 id="family-h" className={h2}>
        {t("demo.familyToday")}
      </h2>
      {day && air.fetchedAt && (
        <PlanSlot
          words={page.words}
          madeAt={page.words.generatedAt && formatInstant(new Date(page.words.generatedAt), air.timeZone, lang)}
          airAt={formatInstant(new Date(air.fetchedAt), air.timeZone, lang)}
          lang={lang}
        />
      )}
      {day ? (
        <TodayRows
          family={family}
          rows={day.rows}
          lines={page.words.rows}
          setupVerdict={air.setupVerdict}
          appOrigin={appOrigin}
          lang={lang}
        />
      ) : (
        <p className="m-0 rounded-[16px] border border-rule bg-card p-4">{t("today.noPlan")}</p>
      )}
    </section>
  );
}

/** The band card with the best time (or the no-data card), the old-data, Severe and station notes. */
function TodayAir({ air, lang }: { air: AirView; lang: Lang }) {
  const day = air.day;
  const now = air.setupVerdict !== null ? day?.summary.now : null;
  return (
    <>
      {day && now ? (
        <BandCard lang={lang} band={now.band} aqi={now.aqi} compact>
          <BestLine summary={day.summary} lang={lang} />
        </BandCard>
      ) : (
        <NoDataCard lang={lang} retryHref="/today" />
      )}
      {day?.freshness === "old" && air.fetchedAt && (
        <OldDataNote time={formatInstant(new Date(air.fetchedAt), air.timeZone, lang)} lang={lang} />
      )}
      {day?.severeDay && <SevereNote lang={lang} />}
      {air.stationNote && <StationNote lang={lang} />}
    </>
  );
}

function FamilyActions({ alone, canAdd, isAdmin, lang }: { alone: boolean; canAdd: boolean; isAdmin: boolean; lang: Lang }) {
  const t = translator(lang);
  return (
    <div className="grid gap-3">
      {alone && (
        <div className={`${noteInfo} flex-wrap items-center justify-between`}>
          <p className="m-0 flex items-start gap-2">
            <Users className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
            {t("today.alone")}
          </p>
          {isAdmin && (
            <Link href="/family/invite" className={`${btn.secondary} ${btn.small}`}>
              {t("today.invite")}
            </Link>
          )}
        </div>
      )}
      {canAdd && (
        <Link href="/dependent/new" className={`${btn.secondary} w-full sm:w-max`}>
          <Plus className="size-5" aria-hidden="true" />
          {t("today.addChild")}
        </Link>
      )}
    </div>
  );
}

/** The Breezy bar and the society message for the home area. */
function TodayLinks({ communityHref, lang }: { communityHref: string; lang: Lang }) {
  const t = translator(lang);
  return (
    <div className="grid gap-2 sm:flex sm:flex-wrap">
      <Link href="/ask" className={`${btn.secondary} border-ai text-ai`}>
        <Wind className="size-5" aria-hidden="true" />
        {t("today.askBreezy")}
      </Link>
      <Link href={communityHref} className={btn.secondary}>
        <Megaphone className="size-5" aria-hidden="true" />
        {t("today.community")}
      </Link>
    </div>
  );
}
