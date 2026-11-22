import type { DayOutlook } from "@/domain/air/outlook";
import { formatWindow } from "@/domain/time/format";
import { bandWordKey, weekdayKey } from "@/i18n/labels";
import { translator, type Lang } from "@/i18n/t";
import { BAND_BG } from "../ui/bandStyle";
import { BandGlyph } from "../ui/icons";

/**
 * Next 5 days (F20, design D): a real list, one row per day on phones and five columns from 30 rem
 * of width; it never scrolls sideways. `showBest` is off in the compact strip on Today and the demo.
 */
export function DayStrip({ days, lang, showBest = true }: { days: readonly DayOutlook[]; lang: Lang; showBest?: boolean }) {
  const t = translator(lang);
  return (
    <div className="@container">
      <ul aria-label={t("air.days.label")} className="m-0 grid list-none gap-1.5 p-0 @min-[30rem]:grid-cols-5">
        {days.map((day) => (
          <li key={day.date} className="grid min-w-0 grid-cols-[0.4375em_1fr] overflow-hidden rounded-sm border border-rule bg-card">
            <span className={BAND_BG[day.worstBand]} aria-hidden="true" />
            <span className="grid min-h-11 grid-cols-[2.75em_1fr_auto] items-center gap-2 px-3 py-1.5 @min-[30rem]:grid-cols-1 @min-[30rem]:gap-1">
              <span className="font-bold">{t(weekdayKey(day.weekday))}</span>
              <span className="flex items-center gap-1.5 text-[0.9375em] leading-tight font-bold">
                <BandGlyph band={day.worstBand} className="size-[1.125em] shrink-0" />
                {t(bandWordKey(day.worstBand))}
              </span>
              {showBest && day.best && (
                <span className="text-right text-sm leading-snug text-ink-muted @min-[30rem]:text-left">
                  {t("air.days.best", { window: formatWindow(day.best.start, day.best.end, lang) })}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
