import { isAdmin } from "@/domain/family/permissions";
import { verdictsAllowed } from "@/domain/air/freshness";
import { initialsOf } from "@/domain/family/caps";
import { UNNAMED_MEMBER } from "@/domain/members/names";
import { settingUpVerdict } from "@/domain/family/tags";
import { ruleContext } from "@/domain/rules/context";
import { INDIA_TIME_ZONE } from "@/domain/time/clock";
import type { AirView, FamilyView, PersonView } from "@/view/app";
import type { FamilyBundle } from "../repos/family";
import type { FamilyPlanDay } from "./familyPlan";

type Member = FamilyBundle["members"][number];
type Dependent = FamilyBundle["dependents"][number];

function memberView({ uid, record }: Member, adminUid: string): PersonView {
  const { ageGroup, careTag, onboarded, language } = record;
  // A Google name that failed the name rules is stored empty; the family still needs to see someone.
  const name = record.name || UNNAMED_MEMBER;
  const base = { id: uid, name, initials: initialsOf(name), kind: "adult" as const, ageGroup, careTag, onboarded, language };
  return {
    ...base,
    admin: uid === adminUid,
    mainMode: record.travel.main,
    guardianUid: null,
    guardianName: null,
    joinedAt: record.joinedVia?.at ?? null,
  };
}

function dependentView({ id, record }: Dependent, guardianName: string | null): PersonView {
  const { name, ageGroup, careTag } = record;
  const base = {
    id,
    name,
    initials: initialsOf(name),
    kind: "dependent" as const,
    ageGroup,
    careTag,
    onboarded: true,
    language: record.cardLanguage,
  };
  return { ...base, admin: false, mainMode: record.travel.main, guardianUid: record.guardianUid, guardianName, joinedAt: null };
}

/** The family's members and dependents as the pages show them (names stay on the server and screen). */
export function familyView(bundle: FamilyBundle, viewerUid: string): FamilyView {
  const { family } = bundle;
  const nameOf = (uid: string) => {
    const member = bundle.members.find((m) => m.uid === uid);
    return member ? member.record.name || UNNAMED_MEMBER : null;
  };
  return {
    id: bundle.id,
    name: family.name,
    placeName: family.home.placeName,
    viewerUid,
    isAdmin: isAdmin(family, viewerUid),
    people: [
      ...bundle.members.map((m) => memberView(m, family.adminUid)),
      ...bundle.dependents.map((d) => dependentView(d, nameOf(d.record.guardianUid))),
    ],
  };
}

/** The air part of a signed-in page, with the "still setting up" chip from the one verdict table. */
export function airView(planned: FamilyPlanDay, now: Date): AirView {
  const { snapshot, day } = planned;
  const current = day && verdictsAllowed(day.freshness) ? day.summary.now : null;
  const timeZone = snapshot?.timeZone ?? INDIA_TIME_ZONE;
  const ctx = ruleContext({ now, timeZone }, planned.region, false);
  return {
    day,
    fetchedAt: snapshot?.fetchedAt.toISOString() ?? null,
    timeZone,
    stationNote: planned.stationNote,
    setupVerdict: current ? settingUpVerdict(current.band, ctx) : null,
  };
}
