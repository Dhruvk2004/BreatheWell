/**
 * The cigarette comparison (Berkeley Earth): one cigarette ≈ 22 µg/m³ of PM2.5 breathed
 * for a whole day. Whole days only, never per activity; always "about" and whole numbers. Rendered
 * only by code, only on adult members' plans or in the collapsed "For adults" panel.
 */
export const PM25_PER_CIGARETTE = 22;

export interface CigaretteFigure {
  /** Rounded whole cigarettes, at least 1 when shown as a number. */
  readonly count: number;
  /** Under half a cigarette: shown as "less than 1", never as 0. */
  readonly lessThanOne: boolean;
}

/** Cigarettes per day for a day-average PM2.5 (µg/m³). */
export function cigarettesPerDay(dayAveragePm25: number): CigaretteFigure {
  const exact = Math.max(0, dayAveragePm25) / PM25_PER_CIGARETTE;
  const rounded = Math.round(exact);
  return rounded < 1 ? { count: 1, lessThanOne: true } : { count: rounded, lessThanOne: false };
}
