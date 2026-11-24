import { z } from "zod";
import type { Activity, ActivityType, Duration, Flex, TripLength } from "../rules/activities";
import { conditionsConsistent } from "../rules/conditionTicks";
import { careTagOf, sensitivityGroup, type AdultAgeGroup, type CareTag, type Condition } from "../rules/groups";
import type { Mode } from "../rules/modes";
import { LANGS } from "../time/format";
import { nameSchema } from "./names";

/** "My usual outdoor activities"; "I mostly stay in" is an empty list. */
export const ADULT_CHOICES = ["morning_walk", "school_trip", "office_trip", "sport", "evening_walk", "errands", "tuition"] as const;
export type AdultChoice = (typeof ADULT_CHOICES)[number] & ActivityType;

/** Usual time bands and the start the rules check for each. */
export const TIME_BANDS = ["early", "morning", "midday", "afternoon", "evening", "night"] as const;
export type TimeBand = (typeof TIME_BANDS)[number];
export const BAND_START: Readonly<Record<TimeBand, string>> = {
  early: "06:00",
  morning: "08:00",
  midday: "12:00",
  afternoon: "15:00",
  evening: "18:00",
  night: "20:00",
};

/** Defaults per activity (spec 6.1 6a–6c): school and office are fixed; walks, sport and errands move. */
export const CHOICE_DEFAULTS: Readonly<Record<AdultChoice, { band: TimeBand; flex: Flex; duration: Duration }>> = {
  morning_walk: { band: "early", flex: "any", duration: "15to60" },
  school_trip: { band: "morning", flex: "fixed", duration: "15to60" },
  office_trip: { band: "morning", flex: "fixed", duration: "15to60" },
  sport: { band: "evening", flex: "any", duration: "over60" },
  evening_walk: { band: "evening", flex: "any", duration: "15to60" },
  errands: { band: "evening", flex: "any", duration: "15to60" },
  tuition: { band: "evening", flex: "fixed", duration: "15to60" },
};

/** Main ways adults travel; "home" = works or studies from home. */
export const ADULT_MODES = ["walk", "cycle", "two_wheeler", "auto_bus", "metro", "car", "home"] as const satisfies readonly Mode[];
export const ADULT_CONDITIONS = [
  "asthma",
  "copd",
  "heart",
  "allergies",
  "pregnant",
  "none",
  "prefer_not",
] as const satisfies readonly Condition[];
export const SHARE_WITH = ["self", "admin", "family"] as const;
const TRIPS = ["under15", "15to45", "over45"] as const satisfies readonly TripLength[];

const activityInput = z.strictObject({
  type: z.enum(ADULT_CHOICES),
  band: z.enum(TIME_BANDS),
  flex: z.enum(["fixed", "some", "any"]),
  duration: z.enum(["under15", "15to60", "over60"]),
});

const travelInput = z.strictObject({
  main: z.enum(ADULT_MODES),
  tripLength: z.enum(TRIPS),
  others: z.array(z.enum(ADULT_MODES).exclude(["home"])).max(5),
});

/** Everything an adult tells us about themself; the server re-validates it. */
export const profileInput = z
  .strictObject({
    name: nameSchema(30),
    language: z.enum(LANGS),
    ageGroup: z.enum(["18to59", "60plus"]),
    conditions: z.array(z.enum(ADULT_CONDITIONS)).max(ADULT_CONDITIONS.length),
    shareWith: z.enum(SHARE_WITH),
    activities: z.array(activityInput).max(4),
    travel: travelInput,
  })
  .refine((p) => new Set(p.activities.map((a) => a.type)).size === p.activities.length, { path: ["activities"] })
  .refine((p) => p.ageGroup === "18to59" || !p.conditions.includes("pregnant"), { path: ["conditions"] })
  .refine((p) => conditionsConsistent(p.conditions), { path: ["conditions"] });

export type ProfileInput = z.infer<typeof profileInput>;
export type ActivityInput = ProfileInput["activities"][number];

/** The rules' activities for a profile; the id is the activity type, unique per person. */
export const memberActivities = (activities: readonly ActivityInput[]): Activity[] =>
  activities.map(({ type, band, flex, duration }) => ({ id: type, type, usual: BAND_START[band], flex, duration }));

/** The tag the family sees instead of condition names. */
export const memberCareTag = (ageGroup: AdultAgeGroup, conditions: readonly Condition[]): CareTag =>
  careTagOf(sensitivityGroup(ageGroup, conditions));

/** The time band an "HH:MM" start falls in (back from a stored activity to the editor). */
export function bandOf(usual: string): TimeBand {
  const found = TIME_BANDS.find((band) => BAND_START[band] === usual);
  return found ?? "morning";
}

/** What the server stores for the rules (users.profile and the member doc): no condition names. */
export function storedProfileOf(input: ProfileInput) {
  return {
    ageGroup: input.ageGroup,
    careTag: memberCareTag(input.ageGroup, input.conditions),
    activities: memberActivities(input.activities),
    travel: { ...input.travel, others: input.travel.others.filter((mode) => mode !== input.travel.main) },
  };
}

/** A member who joined before onboarding: planned as setting up until they answer. */
export const SETTING_UP_PROFILE = {
  ageGroup: "18to59",
  careTag: "none",
  activities: [],
  travel: { main: "home", tripLength: "under15", others: [] },
} as const;
