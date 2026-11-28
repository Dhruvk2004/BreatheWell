import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { dbAs, ROLES, rulesEnv, seed, SEED, type Role } from "./rulesSeed";

/**
 * Security rules: every role × every path × read / create / update / delete. Default
 * deny; the few client paths are opened deliberately. All other writes go through route handlers.
 */
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await rulesEnv();
});
afterAll(async () => env?.cleanup());
beforeEach(async () => seed(env));

const IN_FAMILY: readonly Role[] = ["member", "guardian", "admin"];

/** Who may read each seeded path. */
const READ: Readonly<Record<string, readonly Role[]>> = {
  "users/admin": ["admin"],
  "users/member": ["member"],
  "users/removed": ["removed"],
  "users/admin/private/health": ["admin"],
  "users/member/private/health": ["member", "admin"],
  "users/guardian/private/health": ["guardian", "member", "admin"],
  "families/f1": IN_FAMILY,
  "families/f1/private/home": IN_FAMILY,
  "families/f1/members/member": IN_FAMILY,
  "families/f1/dependents/d1": IN_FAMILY,
  "families/f1/plans/2026-11-21": IN_FAMILY,
  "families/f1/plans/2026-11-21/members/member": IN_FAMILY,
  "families/f1/items/forMember": IN_FAMILY,
  "families/f1/progress/2026-11-21_member": IN_FAMILY,
  "joinCodes/K7PM4QXT": [],
  "airCache/28.6_77.2_2026112106": [],
  "communityCache/28.6_77.2_2026-11-21_society": [],
  "rateLimits/join_member": [],
  "quota/2026-11-21": [],
  "quota/2026-11-21/breezy/u_member": [],
  "stats/2026-11-21": [],
};

describe("reads", () => {
  for (const [path, allowed] of Object.entries(READ))
    it.each(ROLES)(`${path} read by %s`, async (role) => {
      const read = getDoc(doc(dbAs(env, role), path));
      await (allowed.includes(role) ? assertSucceeds(read) : assertFails(read));
    });
});

/** Server-only paths: no client creates, replaces or deletes them, whoever they are. */
const SERVER_ONLY = [
  "families/f1",
  "families/new",
  "families/f1/private/home",
  "families/f1/dependents/d1",
  "families/f1/dependents/d2",
  "families/f1/plans/2026-11-21",
  "families/f1/progress/2026-11-21_member",
  "families/f1/items/new",
  "families/f1/members/newcomer",
  "families/f1/members/member",
  "families/f1/members/admin",
  "joinCodes/K7PM4QXT",
  "airCache/28.6_77.2_2026112106",
  "rateLimits/join_member",
  "quota/2026-11-21",
  "quota/2026-11-21/breezy/u_member",
  "communityCache/28.6_77.2_2026-11-21_society",
  "stats/2026-11-21",
  "users/newcomer",
  "users/member",
];

describe("server-only writes", () => {
  for (const path of SERVER_ONLY)
    it.each(ROLES)(`${path}: %s can neither write nor delete`, async (role) => {
      const db = dbAs(env, role);
      await assertFails(setDoc(doc(db, path), { name: "x", memberUids: [role], guardianUid: role, forId: role }));
      // Deleting a document that does not exist changes nothing, so only real documents are tried.
      if (path in SEED) await assertFails(deleteDoc(doc(db, path)));
    });
});

describe("own profile (every write goes through the server)", () => {
  it.each(ROLES)("users/member updated by %s: refused, even for the owner's own profile fields", async (role) => {
    const write = updateDoc(doc(dbAs(env, role), "users/member"), {
      name: "Neha",
      language: "hi",
      aliases: { papa: "admin" },
    });
    await assertFails(write);
  });

  it("refuses link-like names, non-string alias values and server-only fields from the owner", async () => {
    const db = dbAs(env, "member");
    for (const change of [
      { name: "Pay at bit.ly/x9\u202e" },
      { aliases: { papa: 1 } },
      { familyId: "f2" },
      { role: "admin" },
      { onboarded: false },
      { adultConfirmedAt: "x" },
      { name: "x".repeat(31) },
      { name: "" },
      { language: "fr" },
    ])
      await assertFails(updateDoc(doc(db, "users/member"), change));
    const aliases = Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`k${i}`, "admin"]));
    await assertFails(updateDoc(doc(db, "users/member"), { aliases }));
    await assertFails(deleteDoc(doc(db, "users/member")));
  });

  it.each(ROLES)("member doc updated by %s: server only", async (role) => {
    const db = dbAs(env, role);
    for (const change of [
      { ageGroup: "60plus", name: "Dadaji" },
      { activities: [{ type: "anything", usual: 99 }] },
      { travel: "car" },
      { language: "fr" },
    ])
      await assertFails(updateDoc(doc(db, `families/f1/members/${role}`), change));
    await assertFails(updateDoc(doc(db, "families/f1/members/admin"), { name: "x" }));
  });
});
