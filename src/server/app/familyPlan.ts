import { familyDay, type FamilyDay } from "@/domain/family/familyDay";
import type { FamilyPerson } from "@/domain/family/people";
import { TAG_CONDITIONS } from "@/domain/family/tags";
import { cityAt, regionAt } from "@/domain/geo/cities";
import type { HomeSetup } from "@/domain/libraries/homeSetup";
import type { Region } from "@/domain/rules/context";
import { loadAir, type AirDeps } from "../air/service";
import type { AirSnapshot } from "../air/snapshot";
import type { FamilyBundle } from "../repos/family";

/** A home set-up nobody has answered yet: the most careful defaults (no purifier, road-facing). */
export const UNKNOWN_HOME: HomeSetup = {
  purifier: "none",
  freshAirVent: false,
  roadFacing: "not_sure",
  fuel: "lpg",
  incense: "never",
  indoorSmoking: "prefer_not",
};

/** The family's day: the air at home, the rules' plan for everyone set up, and the place flags. */
export interface FamilyPlanDay {
  readonly snapshot: AirSnapshot | null;
  /** Null without air data (no verdicts). */
  readonly day: FamilyDay | null;
  readonly region: Region;
  /** Delhi NCR: "Official stations may read higher". */
  readonly stationNote: boolean;
}

/**
 * The people the rules plan for: onboarded members by their tag (never condition names)
 * and every dependent. Members still setting up are left out.
 */
export function plannedPeople(bundle: FamilyBundle): FamilyPerson[] {
  const adults = bundle.members
    .filter(({ record }) => record.onboarded)
    .map(({ uid, record }): FamilyPerson => ({
      id: uid,
      kind: "adult",
      ageGroup: record.ageGroup,
      conditions: TAG_CONDITIONS[record.careTag],
      activities: record.activities,
      travel: record.travel,
    }));
  const children = bundle.dependents.map(({ id, record }): FamilyPerson => ({
    id,
    kind: "dependent",
    ageGroup: record.ageGroup,
    conditions: record.conditions,
    activities: record.activities,
    travel: record.travel,
  }));
  return [...adults, ...children];
}

/**
 * Plans the family for today from code (answer first): the home cell's air through the
 * shared air service (instance memory → Firestore cache → Open-Meteo), the injected clock in the
 * place's time zone, and the one verdict table. Nothing here calls Gemini; the Today page adds its stored words.
 */
export async function planFamilyToday(bundle: FamilyBundle, viewerUid: string, air: AirDeps): Promise<FamilyPlanDay> {
  const { lat2, lon2, countryCode } = bundle.family.home;
  const region = regionAt(lat2, lon2, countryCode);
  const stationNote = region !== "outside_india" && (cityAt(lat2, lon2)?.ncr ?? false);
  const snapshot = await loadAir({ lat: lat2, lon: lon2 }, air);
  if (!snapshot) return { snapshot, day: null, region, stationNote };
  const day = familyDay({
    air: snapshot.air,
    fetchedAt: snapshot.fetchedAt,
    clock: { now: air.now(), timeZone: snapshot.timeZone },
    region,
    people: plannedPeople(bundle),
    viewerId: viewerUid,
    home: bundle.homeSetup ?? UNKNOWN_HOME,
    ticks: [],
  });
  return { snapshot, day, region, stationNote };
}
