import { z } from "zod";
import { ACTIVITY_TYPES } from "@/domain/rules/activities";
import { MODES } from "@/domain/rules/modes";
import { LANGS } from "@/domain/time/format";

/**
 * The stored documents (spec 9.1), parsed on every read so a hand-edited or old document can never
 * reach a page as the wrong shape. Timestamps are ISO strings on this side (`db/timestamps.ts`).
 */
const activity = z.object({
  id: z.string(),
  type: z.enum(ACTIVITY_TYPES),
  usual: z.string(),
  flex: z.enum(["fixed", "some", "any"]),
  duration: z.enum(["under15", "15to60", "over60"]),
});
const travel = z.object({ main: z.enum(MODES), tripLength: z.enum(["under15", "15to45", "over45"]), others: z.array(z.enum(MODES)) });
const careTag = z.enum(["none", "sensitive", "extra"]);
const conditions = z.array(z.enum(["asthma", "copd", "heart", "allergies", "pregnant", "not_sure", "none", "prefer_not"]));

export const storedProfile = z.object({ ageGroup: z.enum(["18to59", "60plus"]), careTag, activities: z.array(activity), travel });

export const userRecord = z.object({
  name: z.string(),
  language: z.enum(LANGS),
  textSize: z.enum(["md", "lg", "xl"]),
  familyId: z.string().nullable(),
  role: z.enum(["admin", "member"]).nullable(),
  onboarded: z.boolean(),
  adultConfirmedAt: z.string(),
  aliases: z.record(z.string(), z.string()).default({}),
  profile: storedProfile.nullable().default(null),
  /** The family the user was removed from, shown once ("You're no longer in Sharma family"). */
  removedFrom: z.string().nullable().default(null),
});

export const healthRecord = z.object({ conditions, shareWith: z.enum(["self", "admin", "family"]) });

const home = z.object({
  placeName: z.string(),
  lat2: z.number(),
  lon2: z.number(),
  gridId: z.string(),
  countryCode: z.string().nullable().default(null),
});

export const familyRecord = z.object({
  name: z.string(),
  adminUid: z.string(),
  memberUids: z.array(z.string()),
  home,
  createdAt: z.string(),
});

export const homeSetupRecord = z.object({
  purifier: z.enum(["none", "one_room", "several"]),
  freshAirVent: z.boolean(),
  roadFacing: z.enum(["yes", "no", "not_sure"]),
  fuel: z.enum(["lpg", "electric", "solid"]),
  incense: z.enum(["daily", "sometimes", "never"]),
  indoorSmoking: z.enum(["yes", "no", "prefer_not"]),
});

export const memberRecord = storedProfile.extend({
  name: z.string(),
  onboarded: z.boolean(),
  language: z.enum(LANGS),
  joinedAt: z.string(),
  joinedVia: z.object({ code: z.string(), at: z.string() }).nullable(),
});

export const dependentRecord = z.object({
  name: z.string(),
  ageGroup: z.enum(["under13", "13to17"]),
  conditions,
  careTag,
  activities: z.array(activity),
  travel,
  cardLanguage: z.enum(LANGS),
  guardianUid: z.string(),
  createdAt: z.string(),
});

export const itemRecord = z.object({
  forId: z.string(),
  date: z.string(),
  time: z.string().nullable(),
  kind: z.enum(["plan", "checklist"]),
  text: z.object({ en: z.string().optional(), hi: z.string().optional() }),
  addedBy: z.string(),
  addedByName: z.string(),
  done: z.boolean(),
});

export const progressRecord = z.object({
  forId: z.string(),
  date: z.string(),
  done: z.record(z.string(), z.string()),
  protectedHours: z.number(),
  co2AvoidedKg: z.number(),
  carTrips: z.number().default(0),
});

export const joinCodeRecord = z.object({
  familyId: z.string(),
  createdBy: z.string(),
  expiresAt: z.string(),
  uses: z.number(),
  maxUses: z.number(),
  active: z.boolean(),
});

export type UserRecord = z.infer<typeof userRecord>;
export type StoredProfile = z.infer<typeof storedProfile>;
export type HealthRecord = z.infer<typeof healthRecord>;
export type FamilyRecord = z.infer<typeof familyRecord>;
export type MemberRecord = z.infer<typeof memberRecord>;
export type DependentRecord = z.infer<typeof dependentRecord>;
export type ItemRecord = z.infer<typeof itemRecord>;
export type ProgressRecord = z.infer<typeof progressRecord>;
export type JoinCodeRecord = z.infer<typeof joinCodeRecord>;

/** Parses a stored document, or null when it is missing or not the expected shape. */
export function parsed<S extends z.ZodType>(schema: S, data: unknown): z.output<S> | null {
  if (data === null || data === undefined) return null;
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}
