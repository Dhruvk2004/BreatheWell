import { hoursBetween, type Clock } from "../time/clock";

/** Spec 8.5: fresh ≤ 3 h; old 3–12 h (banner, verdicts kept); stale > 12 h (no band, no verdicts). */
export type Freshness = "fresh" | "old" | "stale";

export const FRESH_HOURS = 3;
export const OLD_HOURS = 12;

/**
 * How fresh an air reading is, measured against the injected clock: the real time on live pages,
 * `scenarioNow` in recorded demo scenarios (so they are never blanked).
 */
export function freshness(fetchedAt: Date, clock: Clock): Freshness {
  const age = hoursBetween(fetchedAt, clock.now);
  if (age <= FRESH_HOURS) return "fresh";
  if (age <= OLD_HOURS) return "old";
  return "stale";
}

/** True when verdicts may be shown (fresh or old data). */
export const verdictsAllowed = (state: Freshness): boolean => state !== "stale";
