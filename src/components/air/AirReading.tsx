import { displayAqi } from "@/domain/air/bands";
import type { AirNowModel, Reading } from "@/domain/public/airNow";
import { formatInstant } from "@/domain/time/instant";
import { translator, type Lang } from "@/i18n/t";
import { BandCard } from "./BandCard";
import { BestLine } from "./BestLine";
import { OldDataNote, StationNote } from "./AirStates";

interface AirReadingProps {
  readonly model: AirNowModel;
  readonly reading: Reading;
  readonly fetchedAt: Date;
  readonly timeZone: string;
  readonly lang: Lang;
}

/** The answer first: old-data banner, band card with the 24-h average and main pollutant, best time, station note. */
export function AirReading({ model, reading, fetchedAt, timeZone, lang }: AirReadingProps) {
  const t = translator(lang);
  const { avg24 } = model.summary;
  const averageLine = avg24 === null ? "" : ` · ${t("air.avg24", { aqi: displayAqi(avg24) })}`;
  return (
    <>
      {model.freshness === "old" && <OldDataNote time={formatInstant(fetchedAt, timeZone, lang)} lang={lang} />}
      <BandCard
        lang={lang}
        band={reading.band}
        aqi={reading.aqi}
        meta={
          <>
            <span>
              {t("air.nowEstimate")}
              {averageLine}
            </span>
            <span className="text-ink-muted">
              {t("air.main", { pollutant: t(`air.main.${reading.main}`) })} · {t("air.calculated")}
            </span>
            {model.outsideIndia && <span className="font-bold">{t("air.outsideIndia")}</span>}
          </>
        }
      >
        <BestLine summary={model.summary} lang={lang} />
      </BandCard>
      {model.stationNote && <StationNote lang={lang} />}
    </>
  );
}
