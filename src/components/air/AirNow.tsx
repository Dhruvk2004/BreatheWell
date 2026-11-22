import type { AirNowModel } from "@/domain/public/airNow";
import { formatInstant } from "@/domain/time/instant";
import { translator, type Lang } from "@/i18n/t";
import type { AirNowPage } from "@/view/airNowPage";
import { h2, sourceLine } from "../ui/styles";
import { NoDataCard, SafeAnyway } from "./AirStates";
import { AirReading } from "./AirReading";
import { CareRows } from "./CareRows";
import { CommunityCard } from "./CommunityCard";
import { DaySection } from "./DaySection";
import { HourStrip } from "./HourStrip";
import { PlaceLine } from "./PlaceLine";
import { PollutantDetails } from "./PollutantDetails";
import { SignInCta } from "./SignInCta";
import { SwapCard } from "./SwapCard";
import { TipList } from "./TipList";
import { WhyMornings } from "./WhyMornings";
import { communityHref } from "../place/airHref";

type Loaded = Extract<AirNowPage, { kind: "ready" | "unavailable" }>;

/** Air now for a place (spec 10.2): the answer first, then the day, the advice and the sources. */
export function AirNow({ page, lang, retryHref }: { page: Loaded; lang: Lang; retryHref: string }) {
  const t = translator(lang);
  const name = page.place.label;
  const reading = page.kind === "ready" ? page.model.reading : null;
  return (
    <div className="grid gap-5">
      <PlaceLine name={name} lang={lang} />
      {page.kind === "ready" && reading ? (
        <>
          <AirReading model={page.model} reading={reading} fetchedAt={page.fetchedAt} timeZone={page.timeZone} lang={lang} />
          <AirDay model={page.model} lang={lang} />
          <AirAdvice model={page.model} lang={lang} />
          {page.community && (
            <CommunityCard
              message={page.community}
              place={name}
              href={communityHref({ name: page.place.name ?? name, lat: page.place.lat, lon: page.place.lon, countryCode: null })}
              lang={lang}
            />
          )}
        </>
      ) : (
        <>
          <NoDataCard lang={lang} retryHref={retryHref} />
          <SafeAnyway lang={lang} />
        </>
      )}
      <SignInCta lang={lang} />
      {page.kind === "ready" && (
        <p className={sourceLine}>
          {t("air.source", { time: formatInstant(page.fetchedAt, page.timeZone, lang) })}
          {page.model.stationNote && ` ${t("air.sourceDelhi")}`} {t("air.calculated")}
        </p>
      )}
    </div>
  );
}

function AirDay({ model, lang }: { model: AirNowModel; lang: Lang }) {
  const { summary } = model;
  return (
    <>
      <section aria-labelledby="hours-h" className="grid gap-2">
        <h2 id="hours-h" className={h2}>
          {translator(lang)("air.strip.title")}
        </h2>
        <HourStrip summary={summary} lang={lang} />
      </section>
      <DaySection days={summary.outlook} lang={lang} headingId="days-h" />
      <CareRows rows={model.care} best={summary.best} windowDay={summary.windowDay} lang={lang} />
    </>
  );
}

function AirAdvice({ model, lang }: { model: AirNowModel; lang: Lang }) {
  return (
    <>
      <TipList tips={model.tips} airOutAt={model.airOutAt} lang={lang} headingId="home-h" />
      <SwapCard mode={model.swap.mode} co2Kg={model.swap.co2Kg} lang={lang} />
      {model.morning && <WhyMornings morning={model.morning} lang={lang} />}
      <PollutantDetails values={model.pollutants} cigarettes={model.cigarettes} lang={lang} />
    </>
  );
}
