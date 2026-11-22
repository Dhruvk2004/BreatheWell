import type { ReactNode } from "react";
import { displayAqi, type Band } from "@/domain/air/bands";
import { bandPlainKey, bandWordKey } from "@/i18n/labels";
import { translator, type Lang } from "@/i18n/t";
import { BAND_FILL } from "../ui/bandStyle";
import { BandGlyph } from "../ui/icons";

interface BandCardProps {
  readonly lang: Lang;
  readonly band: Band;
  readonly aqi: number;
  /** Smaller number and padding (Demo, Today, the Landing preview). */
  readonly compact?: boolean;
  /** Replaces the plain word, e.g. "from 4:00 am" on old data. */
  readonly subtitle?: string;
  /** Lines under the colour block: "Now (hourly estimate) · 24-h average 341", main pollutant. */
  readonly meta?: ReactNode;
  /** The best-time line. */
  readonly children?: ReactNode;
}

/**
 * The answer first (design D): band colour + word + icon + number, one sentence for screen readers
 * ("Air quality now 319, Very poor, very unhealthy"). The number never counts up or down.
 */
export function BandCard({ lang, band, aqi, compact = false, subtitle, meta, children }: BandCardProps) {
  const t = translator(lang);
  const word = t(bandWordKey(band));
  const plain = t(bandPlainKey(band));
  return (
    <div
      role="group"
      aria-label={t("air.band.label", { aqi: displayAqi(aqi), word, plain: plain.toLocaleLowerCase(lang === "en" ? "en-IN" : "hi-IN") })}
      className="overflow-hidden rounded-[16px] border border-rule bg-card shadow-card"
    >
      <div
        className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 transition-colors duration-[var(--dur-colour)] ${compact ? "px-4 py-3" : "p-4"} ${BAND_FILL[band]}`}
      >
        <BandGlyph band={band} className="size-9" />
        <div>
          <span className={`block leading-tight font-bold ${compact ? "text-xl" : "text-[1.375rem]"}`}>{word}</span>
          <span className="block">{subtitle ?? plain}</span>
        </div>
        <p key={aqi} className={`m-0 leading-none font-bold tabular-nums ${compact ? "text-[2.5rem]" : "text-aqi"}`}>
          {displayAqi(aqi)}
        </p>
      </div>
      {meta && <div className="grid gap-0.5 px-4 py-3 text-[0.9375em]">{meta}</div>}
      {children}
    </div>
  );
}
