import type { Activity, ActivityType, Duration, Flex, TripLength } from "../rules/activities";
import type { Mode } from "../rules/modes";

/** "What does Riya do outside?". "Mostly stays in" is an empty selection. */
export type DependentChoice = "school_trip" | "play" | "cycling" | "sport" | "tuition";

interface ChoiceDefaults {
  readonly flex: Flex;
  readonly duration: Duration;
  /** Default start times; school has two trips (7–8 am and 1–2 pm). */
  readonly times: readonly string[];
}

/** The dependent defaults table. Type follows from the activity and mode. */
export const DEPENDENT_DEFAULTS: Readonly<Record<DependentChoice, ChoiceDefaults>> = {
  school_trip: { flex: "fixed", duration: "15to60", times: ["07:00", "13:00"] },
  tuition: { flex: "fixed", duration: "15to60", times: ["19:00"] },
  play: { flex: "any", duration: "15to60", times: ["17:00"] },
  sport: { flex: "any", duration: "over60", times: ["16:00"] },
  cycling: { flex: "some", duration: "15to60", times: ["17:00"] },
};

/** Trip length for every dependent: 15–45 min, 10 km in emissions.ts. */
export const DEPENDENT_TRIP_LENGTH: TripLength = "15to45";

/** "Other ways to school" when the optional question is skipped: School bus + Car. */
export const DEFAULT_OTHER_MODES: readonly Mode[] = ["school_bus", "car"];

/** A parent's pick, with an optional changed time ("HH:MM") per default slot. */
export interface DependentPick {
  readonly choice: DependentChoice;
  readonly times?: readonly string[];
}

/**
 * The dependent's activities, filled from the defaults table (pure; used by `/api/dependent`). Ids
 * are stable per choice and slot ("school_trip-1"), so plan items and ticks keep their keys.
 */
export function dependentActivities(picks: readonly DependentPick[]): Activity[] {
  return picks.flatMap(({ choice, times }) => {
    const defaults = DEPENDENT_DEFAULTS[choice];
    const type: ActivityType = choice;
    return defaults.times.map((fallback, i) => ({
      id: `${choice}-${i + 1}`,
      type,
      usual: times?.[i] ?? fallback,
      flex: defaults.flex,
      duration: defaults.duration,
    }));
  });
}

/** The dependent's travel: the main school mode, the chosen other modes or the default ones. */
export function dependentTravel(main: Mode, others?: readonly Mode[]): { main: Mode; tripLength: TripLength; others: Mode[] } {
  const chosen = others && others.length > 0 ? others : DEFAULT_OTHER_MODES;
  return { main, tripLength: DEPENDENT_TRIP_LENGTH, others: chosen.filter((m) => m !== main) };
}
