import { demoPerson } from "@/data/demo/family";
import { demoHref } from "@/data/demo/query";
import { translator, type Lang } from "@/i18n/t";
import type { DemoData } from "@/view/demoPage";
import { BandCard } from "../air/BandCard";
import { BestLine } from "../air/BestLine";
import { DaySection } from "../air/DaySection";
import { NoDataCard, StationNote } from "../air/AirStates";
import { TipList } from "../air/TipList";
import { h2 } from "../ui/styles";
import { DemoControls } from "./DemoControls";
import { BreezyEntry, HelpTheAir, PlanSourceLine, WeekLine } from "./DemoExtras";
import { DemoBanner, ScenarioNote, SevereNote } from "./DemoNotes";
import { FamilyRows } from "./FamilyRows";
import { ViewerCard } from "./ViewerCard";

/**
 * Demo family (spec 10.3): the Sharma family's day from code, at the scenario clock. Verdicts and
 * times always come from the rules. At 6 am on a recorded scenario the lines are the stored Gemini
 * plan where one was recorded (labelled so); everything else is the template, labelled "Simple
 * plan" (never hand-written text presented as Gemini output).
 */
export function DemoFamily({ data, lang }: { data: DemoData; lang: Lang }) {
  const t = translator(lang);
  return (
    <div className="grid gap-5">
      <DemoBanner lang={lang} />
      <h1 className="m-0 text-2xl font-bold">{t("demo.title")}</h1>
      <DemoControls query={data.query} lang={lang} />
      <ScenarioNote data={data} lang={lang} />
      {data.query.view === "neha" ? <DemoBody data={data} lang={lang} /> : <ViewerScope data={data} pageLang={lang} />}
    </div>
  );
}

/**
 * "View as Dadaji" (journey 5.1, design 10.3 "as Dadaji in Hindi"): everything below
 * the controls in the viewer's language at 150%, with one line in the page language saying so.
 */
function ViewerScope({ data, pageLang }: { data: DemoData; pageLang: Lang }) {
  const person = demoPerson(data.query.view);
  const plan = data.day.rows.find((r) => r.person.id === data.query.view);
  if (!person) return <DemoBody data={data} lang={pageLang} />;
  const lang = person.lang;
  return (
    <>
      <p className="m-0 text-sm text-ink-muted">{translator(pageLang)(`demo.viewerCaption.${lang}`, { name: person.name[pageLang] })}</p>
      <div lang={lang} className="grid gap-5">
        {plan && <ViewerCard plan={plan} name={person.name[lang]} mainMode={person.travel.main} lang={lang} />}
        <DemoBody data={data} lang={lang} />
      </div>
    </>
  );
}

/** The air, the family's rows and the day's details, in one language. */
function DemoBody({ data, lang }: { data: DemoData; lang: Lang }) {
  return (
    <>
      <DemoAir data={data} lang={lang} />
      <section aria-labelledby="family-h" className="grid gap-2">
        <h2 id="family-h" className={h2}>
          {translator(lang)("demo.familyToday")}
        </h2>
        <PlanSourceLine at={data.clock.now} timeZone={data.clock.timeZone} lang={lang} stored={storedLabel(data, lang)} />
        <FamilyRows rows={data.day.rows} query={data.query} lines={data.words[lang].rows} lang={lang} />
      </section>
      <DemoDayDetails data={data} lang={lang} />
    </>
  );
}

/** "Made by … stored for this 6 am" while the stored words show; "written for 6 am" later that day. */
function storedLabel(data: DemoData, lang: Lang): "stored" | "later" | null {
  if (data.words[lang].source === "gemini") return "stored";
  return data.storedPlan && data.query.time !== 6 ? "later" : null;
}

/** The band card with the best time, or the no-data card; the Severe and station notes. */
function DemoAir({ data, lang }: { data: DemoData; lang: Lang }) {
  const { day, query } = data;
  const now = day.summary.now;
  return (
    <>
      {now && day.rows.length > 0 ? (
        <BandCard lang={lang} band={now.band} aqi={now.aqi} compact>
          <BestLine summary={day.summary} lang={lang} />
        </BandCard>
      ) : (
        <NoDataCard lang={lang} retryHref={demoHref(query)} />
      )}
      {day.severeDay && <SevereNote lang={lang} />}
      {data.source !== "recorded" && <StationNote lang={lang} />}
    </>
  );
}

/** At home today, Help the air, the week line, the 5-day strip and the Breezy entry. */
function DemoDayDetails({ data, lang }: { data: DemoData; lang: Lang }) {
  const { day } = data;
  return (
    <>
      {day.homeTips.length > 0 && (
        <TipList tips={day.homeTips} airOutAt={day.airOutAt} lang={lang} headingId="demo-home-h" words={data.words[lang].home} />
      )}
      <HelpTheAir action={day.together} lang={lang} words={data.words[lang].together} />
      <WeekLine week={day.week} lang={lang} />
      <DaySection days={day.summary.outlook} lang={lang} headingId="demo-days-h" showBest={false} />
      <BreezyEntry lang={lang} />
    </>
  );
}
