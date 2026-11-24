import { pointAt, type HourIndex } from "../air/hourly";
import { DAY_FIRST_HOUR, DAY_LAST_HOUR } from "../air/windows";
import { cigarettesPerDay, type CigaretteFigure } from "./cigarettes";
import { dayPm25, outsideAllDay } from "./exposure";
import { percentLess } from "./picture";

/**
 * "Picture it" on a Breezy card with an activity and a time, made by code: the
 * smoke during the activity at the card's hour against the day's smokiest hour for it, and, for
 * adults only, the whole-day cigarette figure. Never shown on a dependent's card (spec 6.4 🔒).
 */
export interface CardPicture {
  /** About this many percent less smoke than at `thanHour` (rounded to 10; 0 when it is that hour). */
  readonly lessPercent: number;
  readonly thanHour: number;
  /** A whole day outside today, in cigarettes (adults only). */
  readonly dayOutside: CigaretteFigure;
}

/** Mean PM2.5 over the activity's clock hours, or null when an hour has no data. */
function pmOver(index: HourIndex, date: string, hour: number, span: number): number | null {
  let sum = 0;
  for (let h = hour; h < hour + span; h++) {
    const pm = h <= 23 ? pointAt(index, date, h)?.pm25 : null;
    if (pm === null || pm === undefined) return null;
    sum += pm;
  }
  return sum / span;
}

/** The picture for an activity of `span` hours starting at `hour`; null without a full day of data. */
export function cardPicture(index: HourIndex, date: string, hour: number, span: number): CardPicture | null {
  const day = dayPm25(index, date);
  const at = pmOver(index, date, hour, span);
  if (!day || at === null) return null;
  let worst = { hour, pm: at };
  for (let h = DAY_FIRST_HOUR; h <= DAY_LAST_HOUR; h++) {
    const pm = pmOver(index, date, h, span);
    if (pm !== null && pm > worst.pm) worst = { hour: h, pm };
  }
  const lessPercent = percentLess({ pm25: worst.pm, hours: span, factor: 1 }, { pm25: at, hours: span, factor: 1 });
  return { lessPercent, thanHour: worst.hour, dayOutside: cigarettesPerDay(outsideAllDay(day)) };
}
