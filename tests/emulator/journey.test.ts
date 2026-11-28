import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ModelError, type JsonRequest } from "@/ai/shared/gemini";
import { adminFirestore } from "@/firebase/admin";
import { firestoreDb } from "@/firebase/firestoreDb";
import type { InFamily, SignedIn } from "@/server/app/guards";
import { loadKidCard } from "@/server/app/kidCardPage";
import { loadToday } from "@/server/app/todayPage";
import { loadViewer } from "@/server/app/viewer";
import { deleteAccount } from "@/server/handlers/account";
import { askBreezy } from "@/server/handlers/breezy";
import { breezyAction } from "@/server/handlers/breezyAction";
import { leaveFamily } from "@/server/handlers/members";
import { requestPlan } from "@/server/handlers/plan";
import { tickProgress } from "@/server/handlers/progress";
import { createSession } from "@/server/handlers/session";
import { json, request, testApp, type TestApp } from "../helpers/appDeps";
import { reply } from "../helpers/breezy";
import { addRiya, joins, RIYA, sharmaFamily } from "../helpers/family";
import { fakeModel, replyToPrompt } from "../helpers/planReply";

/**
 * One family's whole journey, through the real handlers on the Firestore
 * emulator with Gemini faked: sign up with the 18+ tick, create the family, add a child,
 * join by code, Today's plan (Gemini ok, down, the 80% budget switch, the cap), ticks, a Breezy
 * question and its checklist action, the kid card, leaving and deleting with every doc cleaned up.
 */
const firestore = adminFirestore({ FIREBASE_PROJECT_ID: "demo-breathewell", FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST });
const DATE = "2024-11-18";
const QUOTA = "quota/2024-11-17";
let answer: (r: JsonRequest) => string = (r) => replyToPrompt(r.prompt);
const model = fakeModel((r) => answer(r));
let app: TestApp;
let fid = "";
let riya = "";
let code = "";

const doc = async (path: string) => (await firestore!.doc(path).get()).data();
const exists = async (path: string) => (await firestore!.doc(path).get()).exists;
const plan = async (body: object = {}) => json(await requestPlan(request("/api/plan", { uid: "neha", body }), app.deps));
const viewer = async (uid: string) => (await loadViewer(`session:${uid}`, app.deps)) as SignedIn as InFamily;

beforeAll(async () => {
  if (!firestore) throw new Error("no emulator Firestore");
  for (const c of ["families", "users", "joinCodes", "quota", "rateLimits"]) await firestore.recursiveDelete(firestore.collection(c));
  app = testApp({ db: firestoreDb(firestore), gemini: model });
});
afterAll(async () => firestore?.terminate());

describe("family journey on the emulator", () => {
  it("refuses sign-up without the 18+ tick and stores nothing", async () => {
    const response = await createSession(request("/api/session", { body: { idToken: "token:neha:Neha" } }), app.deps);
    expect(response.status).toBe(400);
    expect(await exists("users/neha")).toBe(false);
  });

  it("signs up, creates the family, adds a child and lets Rahul join by code", async () => {
    const created = await sharmaFamily(app);
    fid = created.fid;
    code = created.code;
    expect((await doc("users/neha"))?.adultConfirmedAt).toBeTruthy();
    riya = await addRiya(app);
    expect(await exists(`families/${fid}/dependents/${riya}`)).toBe(true);
    expect((await joins(app, "rahul", "Rahul", code)).status).toBe(200);
    expect((await doc(`families/${fid}`))?.memberUids).toEqual(["neha", "rahul"]);
    expect(model.calls).toHaveLength(0);
  });

  it("generates Today's plan with Gemini and labels it so, once", async () => {
    expect(await plan()).toEqual({ state: "ready" });
    expect(await doc(`families/${fid}/plans/${DATE}`)).toMatchObject({ source: "gemini", generations: 1, generatingSince: null });
    expect((await loadToday(await viewer("neha"), app.deps)).words.source).toBe("gemini");
    expect(await plan({ retry: true })).toEqual({ state: "ready" });
    expect(model.calls).toHaveLength(1);
  });

  it("a member change makes the plan stale; with Gemini down it falls back to a Simple plan", async () => {
    await addRiya(app, "rahul", { ...RIYA, name: "Aarav", picks: [{ choice: "play" }] });
    expect((await doc(`families/${fid}/plans/${DATE}`))?.stale).toBe(true);
    answer = () => {
      throw new ModelError("timeout");
    };
    expect(await plan()).toEqual({ state: "template" });
    expect(await doc(`families/${fid}/plans/${DATE}`)).toMatchObject({ source: "template", generations: 2, stale: false });
    const words = (await loadToday(await viewer("neha"), app.deps)).words;
    expect(words).toMatchObject({ source: "template", canRetry: true, rows: {} });
  });

  it("at the 80% budget the retry uses the template without calling Gemini, then the day is capped", async () => {
    answer = (r) => replyToPrompt(r.prompt);
    await firestore!.doc(QUOTA).set({ geminiCalls: 200 }, { merge: true });
    const before = model.calls.length;
    expect(await plan({ retry: true })).toEqual({ state: "template" });
    expect(model.calls).toHaveLength(before);
    expect((await doc(`families/${fid}/plans/${DATE}`))?.generations).toBe(3);
    expect(await plan({ retry: true })).toEqual({ state: "capped" });
    await firestore!.doc(QUOTA).set({ geminiCalls: 2 }, { merge: true });
  });

  it("ticks progress: your own plan and a dependent's, never another adult's", async () => {
    const tick = (uid: string, forId: string, key: string) =>
      tickProgress(request("/api/progress", { uid, body: { forId, key, done: true } }), app.deps);
    expect(await json(await tick("neha", "neha", "office_trip"))).toMatchObject({ done: ["office_trip"] });
    expect((await doc(`families/${fid}/progress/${DATE}_neha`))?.done).toHaveProperty("office_trip");
    expect((await tick("rahul", "neha", "office_trip")).status).toBe(403);
    const key = ((await doc(`families/${fid}/dependents/${riya}`))?.activities as { id: string }[])[0].id;
    expect((await tick("rahul", riya, key)).status).toBe(200);
  });

  it("asks Breezy, counts the question and adds its suggestion to Riya's checklist and kid card", async () => {
    // Breezy's tokens follow the order Firestore returns the dependents (random ids), so the fake
    // reply uses whichever token the tokenised question gave Riya.
    let token = "";
    answer = (r) => {
      token = /What should \{(d\d)\} carry\?/u.exec(r.prompt)?.[1] ?? "none";
      return reply(`{${token}} can carry a water bottle today.`);
    };
    const asked = await askBreezy(request("/api/breezy", { uid: "neha", body: { question: "What should Riya carry?" } }), app.deps);
    expect(await json(asked)).toMatchObject({ kind: "reply", text: "Riya can carry a water bottle today." });
    expect(token).toMatch(/^d\d$/u);
    expect(model.calls.at(-1)?.prompt).not.toMatch(/Riya|Neha|Rahul/u);
    expect((await doc(`${QUOTA}/breezy/u_neha`))?.count).toBe(1);
    const item = { en: "Carry a water bottle", hi: "पानी की बोतल साथ रखें" };
    const body = { type: "add_checklist", forId: riya, date: "today", time: null, activity: null, item };
    expect(await json(await breezyAction(request("/api/breezy/action", { uid: "rahul", body }), app.deps))).toMatchObject({ onCard: true });
    const card = await loadKidCard(await viewer("neha"), riya, app.deps);
    expect(card?.kid?.checklist?.map((c) => c.text)).toEqual(["Carry a water bottle"]);
    expect(JSON.stringify(card?.kid?.card)).not.toMatch(/AQI|µg|cigarette/iu);
  });

  it("Rahul leaves with the child he added; Neha deletes her account and every family doc goes", async () => {
    expect(await json(await leaveFamily(request("/api/family/leave", { uid: "rahul" }), app.deps))).toEqual({ ok: true });
    expect(await exists(`families/${fid}/members/rahul`)).toBe(false);
    expect((await doc("users/rahul"))?.familyId).toBeNull();
    const deps = await firestore!.collection(`families/${fid}/dependents`).get();
    expect(deps.docs.map((d) => d.id)).toEqual([riya]);
    expect((await deleteAccount(request("/api/account", { method: "DELETE", uid: "neha" }), app.deps)).status).toBe(200);
    for (const path of [`families/${fid}`, "users/neha", "users/neha/private/health", `joinCodes/${code}`])
      expect(await exists(path), path).toBe(false);
    for (const sub of ["members", "dependents", "items", "plans", "progress", "private"])
      expect((await firestore!.collection(`families/${fid}/${sub}`).get()).size, sub).toBe(0);
    expect(app.auth.deleted).toEqual(["neha"]);
  });
});
