import { readFileSync } from "node:fs";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";

/**
 * The family every rules test runs against (spec 9.2 matrix): an admin, a member, a guardian (the
 * member who added dependent d1), a removed member (still has a profile, no longer in
 * `memberUids`) and a stranger. Seeded with the rules switched off, as the server would write it.
 */
export const ROLES = ["anonymous", "stranger", "member", "guardian", "admin", "removed"] as const;
export type Role = (typeof ROLES)[number];

export async function rulesEnv(): Promise<RulesTestEnvironment> {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:3480").split(":");
  return initializeTestEnvironment({
    projectId: "demo-breathewell",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host, port: Number(port) },
  });
}

const profile = (familyId: string | null, role: string | null) => ({
  name: "Asha",
  language: "en",
  familyId,
  role,
  onboarded: true,
  aliases: {},
});
const member = {
  name: "Asha",
  language: "en",
  ageGroup: "18to59",
  careTag: "none",
  activities: [],
  travel: { main: "metro", tripLength: "15to45", others: [] },
  onboarded: true,
};

export const SEED: Readonly<Record<string, Record<string, unknown>>> = {
  "users/admin": profile("f1", "admin"),
  "users/member": profile("f1", "member"),
  "users/guardian": profile("f1", "member"),
  "users/removed": profile(null, null),
  "users/stranger": profile("f2", "admin"),
  "users/admin/private/health": { conditions: ["asthma"], shareWith: "self" },
  "users/member/private/health": { conditions: ["allergies"], shareWith: "admin" },
  "users/guardian/private/health": { conditions: ["heart"], shareWith: "family" },
  "families/f1": {
    name: "Sharma family",
    adminUid: "admin",
    memberUids: ["admin", "member", "guardian"],
    home: { placeName: "Green Park", lat2: 28.56, lon2: 77.21, gridId: "28.6_77.2" },
  },
  "families/f2": {
    name: "Kulkarni family",
    adminUid: "stranger",
    memberUids: ["stranger"],
    home: { placeName: "Kothrud", lat2: 18.5, lon2: 73.8, gridId: "18.5_73.8" },
  },
  "families/f1/private/home": {
    purifier: "none",
    freshAirVent: false,
    roadFacing: "yes",
    fuel: "lpg",
    incense: "never",
    indoorSmoking: "no",
  },
  "families/f1/members/admin": member,
  "families/f1/members/member": member,
  "families/f1/members/guardian": member,
  "families/f1/dependents/d1": { name: "Riya", ageGroup: "under13", guardianUid: "guardian", conditions: [], careTag: "sensitive" },
  "families/f1/plans/2026-11-21": { source: "template", stale: false },
  "families/f1/plans/2026-11-21/members/member": { items: [] },
  "families/f1/items/forMember": { forId: "member", addedBy: "admin", done: false, date: "2026-11-21" },
  "families/f1/items/forDep": { forId: "d1", addedBy: "member", done: false, date: "2026-11-21" },
  "families/f1/items/forAdmin": { forId: "admin", addedBy: "admin", done: false, date: "2026-11-21" },
  "families/f1/progress/2026-11-21_member": { forId: "member", done: {} },
  "joinCodes/K7PM4QXT": { familyId: "f1", uses: 0 },
  "airCache/28.6_77.2_2026112106": { gridId: "28.6_77.2" },
  "communityCache/28.6_77.2_2026-11-21_society": { en: "x" },
  "rateLimits/join_member": { count: 1 },
  "quota/2026-11-21": { geminiCalls: 1 },
  "stats/2026-11-21": { plans: 1 },
};

export async function seed(env: RulesTestEnvironment): Promise<void> {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [path, data] of Object.entries(SEED)) await setDoc(doc(ctx.firestore(), path), data);
  });
}

export const dbAs = (env: RulesTestEnvironment, role: Role) =>
  (role === "anonymous" ? env.unauthenticatedContext() : env.authenticatedContext(role)).firestore();
