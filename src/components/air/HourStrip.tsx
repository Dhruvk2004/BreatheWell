import { Table } from "lucide-react";
import { BANDS, displayAqi } from "@/domain/air/bands";
import type { AirSummary } from "@/domain/air/summary";
import { formatHour, formatWindow } from "@/domain/time/format";
import { bandWordKey } from "@/i18n/labels";
import { translator, type Lang } from "@/i18n/t";
import { aqiBarHeight, BAND_BG } from "../ui/bandStyle";
import { btn, summaryRow } from "../ui/styles";
import { bandRuns, bandsPresent } from "./hourRuns";

const AXIS_HOURS = [0, 6, 12, 18, 23];
/** Left half: grows right from the window's start; right half: grows left from its end, so it never overflows. */
const markerPosition = (start: number, end: number) => {
  const minWidth = `${((end - start) / 24) * 100}%`;
  return start < 12 ? { left: `${(start / 24) * 100}%`, minWidth } : { right: `${((24 - end) / 24) * 100}%`, minWidth };
};

/**
 * Today, hour by hour (design D): one picture with a sentence label (bars are not focusable: 11 px
 * targets would fail WCAG 2.5.8), the legend, a "Now" line and "Show as table" with a real table.
 */
export function HourStrip({ summary, lang }: { summary: AirSummary; lang: Lang }) {
  const t = translator(lang);
  const { now } = summary;
  return (
    <div className="grid gap-2">
      <StripPicture summary={summary} lang={lang} />
      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-sm" aria-hidden="true">
        {bandsPresent(summary.today, BANDS).map((band) => (
          <span key={band} className="inline-flex items-center gap-1.5">
            <i className={`inline-block size-3.5 rounded-[3px] ${BAND_BG[band]}`} />
            {t(bandWordKey(band))}
          </span>
        ))}
      </div>
      {now && (
        <p className="m-0 text-[0.9375em]">
          <b>{t("air.strip.now", { time: formatHour(now.hour, lang) })}</b> {t(bandWordKey(now.band))} · {displayAqi(now.aqi)}
        </p>
      )}
      <HourTable summary={summary} lang={lang} />
    </div>
  );
}

/** The bars as one `role="img"` with a sentence: "Very poor 12–10 am; Poor 10 am–2 pm; …". */
function StripPicture({ summary, lang }: { summary: AirSummary; lang: Lang }) {
  const t = translator(lang);
  const runs = bandRuns(summary.today).map((r) =>
    t("air.strip.run", { band: t(bandWordKey(r.band)), window: formatWindow(r.start, r.end, lang) }),
  );
  const { best } = summary;
  return (
    <div role="img" aria-label={`${t("air.strip.label")} ${runs.join("; ")}.`} className="relative pt-7">
      {best && summary.windowDay !== "tomorrow" && (
        <span
          className="absolute top-0 border-t-2 border-brand pt-0.5 text-sm font-bold whitespace-nowrap text-brand"
          style={markerPosition(best.start, best.end)}
        >
          {t("air.strip.best", { window: formatWindow(best.start, best.end, lang) })}
        </span>
      )}
      <div className="grid h-[5.5em] grid-cols-24 items-end gap-0.5 border-b border-rule-strong">
        {summary.today.map((p, h) => (
          <i
            key={h}
            className={`block rounded-t-[3px] ${p ? BAND_BG[p.band] : ""} ${h === summary.hour ? "outline-2 outline-offset-1 outline-ink" : ""}`}
            style={{ height: p ? aqiBarHeight(p.aqi) : 0 }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-sm text-ink-muted" aria-hidden="true">
        {AXIS_HOURS.map((h) => (
          <span key={h}>{formatHour(h, lang)}</span>
        ))}
      </div>
    </div>
  );
}

function HourTable({ summary, lang }: { summary: AirSummary; lang: Lang }) {
  const t = translator(lang);
  return (
    <details>
      <summary className={`${summaryRow} ${btn.secondary} ${btn.small} w-max`}>
        <Table className="size-5" aria-hidden="true" />
        {t("air.strip.table")}
      </summary>
      <table className="mt-2 w-full border-collapse text-left text-[0.9375em]">
        <caption className="sr-only">{t("air.strip.caption")}</caption>
        <thead>
          <tr className="border-b border-rule-strong">
            <th scope="col" className="py-1.5 pr-3">
              {t("air.strip.hour")}
            </th>
            <th scope="col" className="py-1.5 pr-3">
              {t("air.strip.band")}
            </th>
            <th scope="col" className="py-1.5">
              {t("air.strip.aqi")}
            </th>
          </tr>
        </thead>
        <tbody>
          {summary.today.map((p, h) =>
            p ? (
              <tr key={h} className="border-b border-rule">
                <th scope="row" className="py-1.5 pr-3 font-normal">
                  {formatHour(h, lang)}
                </th>
                <td className="py-1.5 pr-3">{t(bandWordKey(p.band))}</td>
                <td className="py-1.5 tabular-nums">{displayAqi(p.aqi)}</td>
              </tr>
            ) : null,
          )}
        </tbody>
      </table>
    </details>
  );
}
