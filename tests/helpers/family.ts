import { createFamily } from "@/server/handlers/family";
import { joinFamily } from "@/server/handlers/join";
import { saveProfile } from "@/server/handlers/profile";
import { createSession } from "@/server/handlers/session";
import type { ProfileInput } from "@/domain/members/profile";
import type { DependentInput } from "@/domain/dependents/schema";
import { addDependent } from "@/server/handlers/dependent";
import { json, request, type TestApp } from "./appDeps";

/** Neha's answers (the main example user): office trip at 8:30 by scooter, metro as the other way. */
export const PROFILE: ProfileInput = {
  name: "Neha",
  language: "en",
  ageGroup: "18to59",
  conditions: ["none"],
  shareWith: "self",
  activities: [{ type: "office_trip", band: "morning", flex: "fixed", duration: "15to60" }],
  travel: { main: "two_wheeler", tripLength: "15to45", others: ["metro"] },
};

export const HOME = { name: "Green Park, New Delhi", lat: 28.5594, lon: 77.2066, countryCode: "IN" };
export const HOME_SETUP = {
  purifier: "one_room",
  freshAirVent: false,
  roadFacing: "yes",
  fuel: "lpg",
  incense: "sometimes",
  indoorSmoking: "no",
} as const;

export const RIYA: DependentInput = {
  name: "Riya",
  ageGroup: "under13",
  conditions: ["asthma"],
  picks: [{ choice: "school_trip" }, { choice: "play" }],
  travel: { main: "cycle", others: [] },
  cardLanguage: "en",
};

/** Signs a user in (the 18+ tick sent), optionally saving their profile. */
export async function signUp(app: TestApp, uid: string, name: string, profile: Partial<ProfileInput> | null = {}): Promise<void> {
  const ip = `203.0.113.${uid.length}`;
  const session = await createSession(
    request("/api/session", { body: { idToken: `token:${uid}:${name}`, adultConfirmed: true }, ip }),
    app.deps,
  );
  if (session.status !== 200) throw new Error(`sign-in failed ${session.status}`);
  if (profile) await saveProfile(request("/api/profile", { method: "PUT", uid, body: { ...PROFILE, name, ...profile } }), app.deps);
}

/** Neha signs up and creates the Sharma family; returns the family id and join code. */
export async function sharmaFamily(app: TestApp): Promise<{ fid: string; code: string }> {
  await signUp(app, "neha", "Neha");
  const response = await createFamily(
    request("/api/family", { uid: "neha", body: { name: "Sharma family", home: HOME, homeSetup: HOME_SETUP } }),
    app.deps,
  );
  const { familyId, code } = await json<{ familyId: string; code: string }>(response);
  return { fid: familyId, code };
}

/** Another adult signs up (optionally onboarded) and joins with the code. */
export async function joins(app: TestApp, uid: string, name: string, code: string, onboarded = true): Promise<Response> {
  await signUp(app, uid, name, onboarded ? {} : null);
  return joinFamily(request("/api/join", { uid, body: { code } }), app.deps);
}

export async function addRiya(app: TestApp, uid = "neha", input: DependentInput = RIYA): Promise<string> {
  const response = await addDependent(request("/api/dependent", { uid, body: input }), app.deps);
  return (await json<{ id: string }>(response)).id;
}
