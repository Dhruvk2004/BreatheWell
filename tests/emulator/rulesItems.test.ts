import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dbAs, ROLES, rulesEnv, seed, type Role } from "./rulesSeed";

/**
 * Items, health and removal (spec 9.2): `done` only, by the target member or anyone for a
 * dependent; delete by the target, the adder, the dependent's guardian or the admin; health docs
 * owner-written; a removed member loses every read at once.
 */
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await rulesEnv();
});
afterAll(async () => env?.cleanup());
beforeEach(async () => seed(env));

const run = async (allowed: boolean, op: Promise<unknown>) => (allowed ? assertSucceeds(op) : assertFails(op));

describe("items: done ticks", () => {
  const TICK: Readonly<Record<string, readonly Role[]>> = { forMember: ["member"], forDep: ["member", "guardian", "admin"] };
  for (const [item, allowed] of Object.entries(TICK))
    it.each(ROLES)(`${item} ticked by %s`, async (role) => {
      await run(
        allowed.includes(role),
        updateDoc(doc(dbAs(env, role), `families/f1/items/${item}`), { done: true, doneAt: "2026-11-21T07:00:00Z" }),
      );
    });

  it("changes no other field, takes a boolean and a string or null doneAt", async () => {
    const db = dbAs(env, "member");
    await assertFails(updateDoc(doc(db, "families/f1/items/forMember"), { done: true, forId: "admin" }));
    await assertFails(updateDoc(doc(db, "families/f1/items/forMember"), { text: { en: "skip inhaler" } }));
    await assertFails(updateDoc(doc(db, "families/f1/items/forMember"), { done: "yes" }));
    await assertFails(updateDoc(doc(db, "families/f1/items/forMember"), { done: true, doneAt: 1 }));
    await assertFails(updateDoc(doc(db, "families/f1/items/forMember"), { done: true, doneAt: { at: "x" } }));
    await assertSucceeds(updateDoc(doc(db, "families/f1/items/forMember"), { done: false, doneAt: null }));
  });
});

describe("items: delete", () => {
  // forMember: target member, adder = admin. forDep: adder = member, guardian, admin. forAdmin: admin only.
  const DELETE: Readonly<Record<string, readonly Role[]>> = {
    forMember: ["member", "admin"],
    forDep: ["member", "guardian", "admin"],
    forAdmin: ["admin"],
  };
  for (const [item, allowed] of Object.entries(DELETE))
    it.each(ROLES)(`${item} deleted by %s`, async (role) => {
      await run(allowed.includes(role), deleteDoc(doc(dbAs(env, role), `families/f1/items/${item}`)));
    });
});

describe("health docs", () => {
  it.each(ROLES)("users/member/private/health written by %s", async (role) => {
    await run(
      role === "member",
      setDoc(doc(dbAs(env, role), "users/member/private/health"), { conditions: ["asthma"], shareWith: "family", updatedAt: "x" }),
    );
  });

  it("refuses other keys, a bad share value and too many ticks", async () => {
    const db = dbAs(env, "member");
    await assertFails(setDoc(doc(db, "users/member/private/health"), { conditions: [], shareWith: "everyone" }));
    await assertFails(setDoc(doc(db, "users/member/private/health"), { conditions: [], shareWith: "self", name: "x" }));
    await assertFails(setDoc(doc(db, "users/member/private/health"), { conditions: Array(8).fill("asthma"), shareWith: "self" }));
    await assertFails(setDoc(doc(db, "users/member/private/health"), { conditions: ["cancer"], shareWith: "self" }));
    await assertFails(setDoc(doc(db, "users/member/private/health"), { conditions: ["asthma", 3], shareWith: "self" }));
  });

  it("accepts every known condition", async () => {
    const all = ["asthma", "copd", "heart", "allergies", "pregnant", "none", "prefer_not"];
    await assertSucceeds(setDoc(doc(dbAs(env, "member"), "users/member/private/health"), { conditions: all, shareWith: "self" }));
  });
});

describe("removal (spec 9.2)", () => {
  it("a removed member loses the family, its dependents and items at once", async () => {
    const before = dbAs(env, "member");
    expect((await getDoc(doc(before, "families/f1/dependents/d1"))).exists()).toBe(true);
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), "families/f1"), { memberUids: ["admin", "guardian"] });
    });
    for (const path of [
      "families/f1",
      "families/f1/dependents/d1",
      "families/f1/items/forDep",
      "families/f1/private/home",
      "families/f1/members/admin",
    ])
      await assertFails(getDoc(doc(before, path)));
    await assertFails(updateDoc(doc(before, "families/f1/items/forDep"), { done: true }));
  });
});
