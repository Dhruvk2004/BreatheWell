import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { JsonRequest } from "@/ai/shared/gemini";
import { adminFirestore } from "@/firebase/admin";
import { firestoreDb } from "@/firebase/firestoreDb";
import type { Db, Tx } from "@/server/db/types";
import { requestPlan } from "@/server/handlers/plan";
import { claimPlan } from "@/server/repos/plans";
import { NOW } from "../helpers/airDeps";
import { json, request, testApp, type TestApp } from "../helpers/appDeps";
import { addRiya, joins, sharmaFamily } from "../helpers/family";
import { replyToPrompt } from "../helpers/planReply";

/**
 * The plan lock on real Firestore transactions: two members opening Today at once make
 * one Gemini call, the other is told "busy"; when saving fails the claim is given back (lock
 * cleared, the try not counted), so the next request generates at once instead of waiting 40 s.
 */
const firestore = adminFirestore({ FIREBASE_PROJECT_ID: "demo-breathewell", FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST });
const DATE = "2024-11-18";
const failSave = { on: false };
const calls: JsonRequest[] = [];
let app: TestApp;
let fid = "";

/** The adapter, except that a transaction writing a generated plan throws while `failSave.on`. */
function flakyDb(inner: Db): Db {
  const guard = (tx: Tx): Tx => ({
    get: (p) => tx.get(p),
    query: (c, w) => tx.query(c, w),
    delete: (p) => tx.delete(p),
    set: (p, data, options) => {
      if (failSave.on && "generatedAt" in data) throw Object.assign(new Error("UNAVAILABLE: write failed"), { code: 14 });
      tx.set(p, data, options);
    },
  });
  return {
    ...inner,
    get: inner.get,
    query: inner.query,
    newId: inner.newId,
    deleteTree: inner.deleteTree,
    transaction: (fn) => inner.transaction((tx) => fn(guard(tx))),
  };
}

/** A model that holds its answer until the test lets it go, so other requests arrive mid-generation. */
const gate = { open: Promise.resolve(), release: () => undefined as void };
const slowModel = {
  name: "slow-fake",
  async generateJson(r: JsonRequest) {
    calls.push(r);
    await gate.open;
    return replyToPrompt(r.prompt);
  },
};
const holdModel = () => {
  gate.open = new Promise<void>((resolve) => (gate.release = resolve));
};

/** Waits until a request holds today's lock. */
async function lockTaken(): Promise<void> {
  for (let i = 0; i < 100 && !(await planDoc())?.generatingSince; i++) await new Promise((r) => setTimeout(r, 20));
}

const ask = (uid: string) => requestPlan(request("/api/plan", { uid, body: {} }), app.deps);
const planDoc = async () => (await firestore!.doc(`families/${fid}/plans/${DATE}`).get()).data();

beforeAll(async () => {
  if (!firestore) throw new Error("no emulator Firestore");
  for (const c of ["families", "users", "joinCodes", "quota"]) await firestore.recursiveDelete(firestore.collection(c));
  app = testApp({ db: flakyDb(firestoreDb(firestore)), gemini: slowModel });
  const created = await sharmaFamily(app);
  fid = created.fid;
  await joins(app, "rahul", "Rahul", created.code);
  await addRiya(app);
});
beforeEach(async () => {
  calls.length = 0;
  failSave.on = false;
  gate.open = Promise.resolve();
  await firestore!.recursiveDelete(firestore!.doc(`families/${fid}/plans/${DATE}`));
});
afterAll(async () => firestore?.terminate());

describe("plan lock on the emulator", () => {
  it("a member opening Today mid-generation is told busy, and no second Gemini call is made", async () => {
    holdModel();
    const first = ask("neha");
    await lockTaken();
    const second = await json(await ask("rahul"));
    expect(second).toMatchObject({ state: "busy" });
    expect(second.retryAfterMs).toBeGreaterThan(0);
    gate.release();
    expect(await json(await first)).toEqual({ state: "ready" });
    expect(await planDoc()).toMatchObject({ source: "gemini", generations: 1, generatingSince: null });
    expect(await json(await ask("rahul"))).toEqual({ state: "ready" });
    expect(calls).toHaveLength(1);
  });

  it("five claims racing in Firestore transactions: exactly one wins, the rest are busy", async () => {
    const db = firestoreDb(firestore!);
    const claims = await Promise.all(Array.from({ length: 5 }, () => claimPlan(db, fid, DATE, NOW, false)));
    expect(claims.filter((c) => c.kind === "claimed")).toHaveLength(1);
    expect(claims.filter((c) => c.kind === "busy")).toHaveLength(4);
    expect(await planDoc()).toMatchObject({ generations: 1 });
  });

  it("gives the claim back when saving fails, so the next request generates at once", async () => {
    failSave.on = true;
    await expect(ask("neha")).rejects.toThrow(/write failed/u);
    expect(await planDoc()).toMatchObject({ generatingSince: null, generations: 0 });
    expect((await firestore!.collection(`families/${fid}/plans/${DATE}/members`).get()).size).toBe(0);
    failSave.on = false;
    expect(await json(await ask("rahul"))).toEqual({ state: "ready" });
    expect(await planDoc()).toMatchObject({ source: "gemini", generations: 1 });
    expect(calls).toHaveLength(2);
  });

  it("a release never clears a lock another request took over", async () => {
    failSave.on = true;
    holdModel();
    const first = ask("neha").catch((e: Error) => e);
    await lockTaken();
    const taken = new Date(NOW.getTime() + 1);
    await firestore!.doc(`families/${fid}/plans/${DATE}`).set({ generatingSince: taken, generations: 2 }, { merge: true });
    gate.release();
    expect(await first).toBeInstanceOf(Error);
    const after = await planDoc();
    expect(after?.generatingSince.toDate().toISOString()).toBe(taken.toISOString());
    expect(after?.generations).toBe(2);
  });
});
