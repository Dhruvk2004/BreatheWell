/**
 * Activity-level "Picture it": the smoke breathed during one activity, before and after
 * the change, as a rounded percentage ("about 60% less smoke during your walk").
 */
export interface ActivitySmoke {
  readonly pm25: number;
  readonly hours: number;
  readonly factor: number;
}

/** PM2.5 × hours × place factor. */
export const smokeDose = (s: ActivitySmoke): number => s.pm25 * s.hours * s.factor;

/**
 * Percent less smoke after the change, rounded to the nearest 10 (always shown with "about").
 * 0 when the change does not lower it; 100 when the activity moves indoors entirely.
 */
export function percentLess(before: ActivitySmoke, after: ActivitySmoke | null): number {
  const was = smokeDose(before);
  if (was <= 0) return 0;
  const now = after ? smokeDose(after) : 0;
  const share = Math.max(0, (was - now) / was);
  return Math.round(share * 10) * 10;
}
