import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminFirestore } from "@/firebase/admin";
import { firestoreDb } from "@/firebase/firestoreDb";
import { requestPlan } from "@/server/handlers/plan";
import { LOCK_MS } from "@/server/repos/plans";
import { NOW } from "../helpers/airDeps";
import { json, request, testApp, type TestApp } from "../helpers/appDeps";
import { addRiya, joins, sharmaFamily } from "../helpers/family";
import { fakeModel, replyToPrompt } from "../helpers/planReply";

/**
 * The plan route on real Firestore (spec 7.2, 11.4): the stored plan with Timestamps, a fresh lock
 * that answers "busy" and an expired lock (> 40 s) that the next request takes over. Gemini is a fake.
 */
const firestore = adminFirestore({ FIREBASE_PROJECT_ID: "demo-breathewell", FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST });
let app: TestApp;

beforeAll(async () => {
  if (!firestore) throw new Error("no emulator Firestore");
  await firestore.recursiveDelete(firestore.collection("families"));
  await firestore.recursiveDelete(firestore.collection("quota"));
  app = testApp({ db: firestoreDb(firestore), gemini: fakeModel((r) => replyToPrompt(r.prompt)) });
});
afterAll(async () => firestore?.terminate());

const ask = async () => json(await requestPlan(request("/api/plan", { uid: "neha", body: {} }), app.deps));

describe("family plan on the emulator", () => {
  it("answers busy under a fresh lock, takes over an expired one and stores the plan", async () => {
    if (!firestore) return;
    const { fid, code } = await sharmaFamily(app);
    await joins(app, "rahul", "Rahul", code);
    const riya = await addRiya(app);
    const plan = firestore.doc(`families/${fid}/plans/2024-11-18`);
    await plan.set({ generatingSince: new Date(NOW.getTime() - 5_000), generations: 1 });
    expect(await ask()).toEqual({ state: "busy", retryAfterMs: LOCK_MS - 5_000 });
    await plan.set({ generatingSince: new Date(NOW.getTime() - LOCK_MS - 1_000), generations: 1 });
    expect(await ask()).toEqual({ state: "ready" });
    const stored = (await plan.get()).data();
    expect(stored).toMatchObject({ source: "gemini", generations: 2, generatingSince: null });
    expect(stored?.generatedAt.toDate().toISOString()).toBe(NOW.toISOString());
    expect((await plan.collection("members").doc(riya).get()).exists).toBe(true);
    expect((await firestore.doc("quota/2024-11-17").get()).data()?.geminiCalls).toBe(1);
  });
});
