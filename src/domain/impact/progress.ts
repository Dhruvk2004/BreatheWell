import { DURATION_HOURS, type TripLength } from "../rules/activities";
import type { Mode } from "../rules/modes";
import type { ActivityPlan } from "../rules/plan";
import type { Activity } from "../rules/activities";
import { avoidedBySwap } from "./emissions";

/** A ticked Swap card's progress key is `swap:{altId}` (activity ids never contain a colon). */
export const SWAP_KEY = "swap:";

/** Suggestions whose done tick protects time (north-star metric). */
const PROTECTING = new Set(["move_time", "switch_mode", "indoor"]);

export interface Ticked {
  readonly activity: Activity;
  readonly plan: ActivityPlan;
}

/**
 * The totals stored on a progress doc (computed by the server): protected hours (the
 * activity's duration bucket for a moved, switched or indoor item), kg CO₂ avoided by a switch and
 * the car trips a switch away from the car replaced (the weekly line, spec 7.5). `swapsTo` are the
 * modes of ticked Swap cards, which count like a switched activity but protect no hours.
 */
export function progressTotals(
  ticked: readonly Ticked[],
  travel: { readonly main: Mode; readonly tripLength: TripLength },
  swapsTo: readonly Mode[] = [],
): { protectedHours: number; co2AvoidedKg: number; carTrips: number } {
  const protectedHours = ticked.reduce(
    (sum, { activity, plan }) => sum + (PROTECTING.has(plan.suggestion) ? DURATION_HOURS[activity.duration] : 0),
    0,
  );
  const switched = [...ticked.flatMap(({ plan }) => (plan.switchTo ? [plan.switchTo] : [])), ...swapsTo];
  return {
    protectedHours,
    co2AvoidedKg: switched.reduce((sum, mode) => sum + avoidedBySwap(travel.main, mode, travel.tripLength).co2Kg, 0),
    carTrips: switched.filter((mode) => travel.main === "car" && mode !== "car").length,
  };
}
