import { bandOf, type ProfileInput } from "@/domain/members/profile";
import { isAdmin, mustStay } from "@/domain/family/permissions";
import type { OnboardingPage, ProfilePage, SettingsPage } from "@/view/app";
import { dbOf, type AppDeps } from "../deps";
import { paths } from "../repos/paths";
import { healthRecord, parsed, type UserRecord } from "../repos/records";
import type { SignedIn, InFamily } from "./guards";
import { familyView } from "./familyView";
import { liveCode } from "./invitePages";
import { dayTime } from "@/domain/time/dayTime";
import { INDIA_TIME_ZONE } from "@/domain/time/clock";
import type { Lang } from "@/domain/time/format";

type AdultActivity = ProfileInput["activities"][number]["type"];

/**
 * The saved answers as the onboarding and profile editors take them (one
 * editor for both): the stored activities back to time bands, the health ticks from the private doc.
 */
async function savedInput(user: UserRecord, uid: string, deps: AppDeps): Promise<ProfileInput | null> {
  if (!user.profile) return null;
  const health = parsed(healthRecord, await dbOf(deps).get(paths.health(uid)));
  const { ageGroup, activities, travel } = user.profile;
  return {
    name: user.name,
    language: user.language,
    ageGroup,
    conditions: (health?.conditions ?? []).filter((c) => c !== "not_sure"),
    shareWith: health?.shareWith ?? "self",
    activities: activities.map((a) => ({ type: a.type as AdultActivity, band: bandOf(a.usual), flex: a.flex, duration: a.duration })),
    travel: {
      main: travel.main as ProfileInput["travel"]["main"],
      tripLength: travel.tripLength,
      others: travel.others as ProfileInput["travel"]["others"],
    },
  };
}

export async function loadOnboarding(viewer: SignedIn, deps: AppDeps): Promise<OnboardingPage> {
  return {
    googleName: viewer.user.name,
    input: await savedInput(viewer.user, viewer.uid, deps),
    hasFamily: viewer.bundle !== null,
    familyName: viewer.bundle?.family.name ?? null,
    removedFrom: viewer.bundle ? null : viewer.user.removedFrom,
  };
}

/** Profile settings; null until onboarding has saved a profile. */
export async function loadProfile(viewer: SignedIn, deps: AppDeps): Promise<ProfilePage | null> {
  const input = await savedInput(viewer.user, viewer.uid, deps);
  if (!input) return null;
  const family = viewer.bundle?.family ?? null;
  return {
    input,
    familyName: family?.name ?? null,
    isAdmin: family ? isAdmin(family, viewer.uid) : false,
    mustStay: family ? mustStay(family, viewer.uid) : false,
    dependents: (viewer.bundle?.dependents ?? [])
      .filter((d) => d.record.guardianUid === viewer.uid)
      .map((d) => ({ id: d.id, name: d.record.name })),
  };
}

/**
 * Family settings: everything for the admin, the same page read-only for others; join
 * times formatted for the members list, and the admin's live code for the Invite row.
 */
export async function loadSettingsPage(viewer: InFamily, deps: AppDeps, lang: Lang) {
  const page: SettingsPage = { family: familyView(viewer.bundle, viewer.uid), homeSetup: viewer.bundle.homeSetup };
  const joinedAt = Object.fromEntries(
    page.family.people.flatMap((p) => (p.joinedAt ? [[p.id, dayTime(p.joinedAt, INDIA_TIME_ZONE, lang)]] : [])),
  );
  const invite = isAdmin(viewer.bundle.family, viewer.uid) ? await liveCode(viewer, deps) : null;
  return { page, joinedAt, code: invite?.code ?? null };
}
