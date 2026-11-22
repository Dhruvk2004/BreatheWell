import { isEnclosed, type Mode } from "./modes";

/** Outdoor activities across adults (spec 6.1 item 6) and dependents (6.2). */
export const ACTIVITY_TYPES = [
  "morning_walk",
  "evening_walk",
  "school_trip",
  "office_trip",
  "sport",
  "errands",
  "tuition",
  "play",
  "cycling",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Can it move? Fixed · Can move a bit (±2 h) · Any time today (spec 6.1 item 6b). */
export type Flex = "fixed" | "some" | "any";
/** How long? Under 15 min · 15–60 min · Over 1 hour (spec 6.1 item 6c). */
export type Duration = "under15" | "15to60" | "over60";
/** Typical one-way trip (spec 6.1 item 7a). */
export type TripLength = "under15" | "15to45" | "over45";
/** Activity type for the guardrail table (spec 8.2). */
export type Intensity = "light" | "moderate" | "hard";

export interface Activity {
  readonly id: string;
  readonly type: ActivityType;
  /** Usual start, "HH:MM" local. */
  readonly usual: string;
  readonly flex: Flex;
  readonly duration: Duration;
}

/** Duration buckets in hours (spec 1.5, 7.4): 0.25 / 0.75 / 1.5. */
export const DURATION_HOURS: Readonly<Record<Duration, number>> = { under15: 0.25, "15to60": 0.75, over60: 1.5 };

const TRAVEL: readonly ActivityType[] = ["school_trip", "office_trip", "tuition"];
const ESSENTIAL: readonly ActivityType[] = ["school_trip", "office_trip"];

/** Trips whose intensity comes from the travel mode. */
export const isTravel = (type: ActivityType): boolean => TRAVEL.includes(type);
/** School, college and office trips are never "skip it" (spec 8.3 override 1). */
export const isEssential = (type: ActivityType): boolean => ESSENTIAL.includes(type);

const BY_DURATION: Readonly<Record<Duration, Intensity>> = { under15: "light", "15to60": "moderate", over60: "hard" };

/**
 * Light / Moderate / Hard (spec 8.2). Trips: enclosed travel is Light, open travel Moderate. Sport
 * is Hard; anything over an hour outdoors is Hard; otherwise by duration.
 */
export function intensityOf(type: ActivityType, duration: Duration, mode: Mode): Intensity {
  if (isTravel(type)) return isEnclosed(mode) ? "light" : "moderate";
  if (type === "sport") return "hard";
  return BY_DURATION[duration];
}

/** How many clock hours an activity touches: the window h…h+d−1 (spec 8.4 step 3). */
export const spanHours = (duration: Duration): number => Math.max(1, Math.ceil(DURATION_HOURS[duration]));
