import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminFirestore } from "@/firebase/admin";
import { firestoreDb } from "@/firebase/firestoreDb";
import { deleteAccount } from "@/server/handlers/account";
import { deleteDependent } from "@/server/handlers/dependent";
import { removeMember } from "@/server/handlers/members";
import { request, testApp, type TestApp } from "../helpers/appDeps";
import { addRiya, joins, sharmaFamily } from "../helpers/family";

/**
 * The family flow against real Firestore: create, join with the code,
 * add and delete a dependent, remove a member and delete the admin's account, through the same
 * handlers and the Admin SDK adapter, with timestamps stored as Firestore Timestamps.
 */
const firestore = adminFirestore({ FIREBASE_PROJECT_ID: "demo-breathewell", FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST });
let app: TestApp;

beforeAll(async () => {
  if (!firestore) throw new Error("no emulator Firestore");
  await firestore.recursiveDelete(firestore.collection("families"));
  app = testApp({ db: firestoreDb(firestore) });
});
afterAll(async () => firestore?.terminate());

describe("family flow on the emulator", () => {
  it("creates, joins, adds and erases a dependent, removes a member and deletes the account", async () => {
    if (!firestore) return;
    const { fid, code } = await sharmaFamily(app);
    expect((await joins(app, "rahul", "Rahul", code)).status).toBe(200);
    const family = (await firestore.doc(`families/${fid}`).get()).data();
    expect(family?.memberUids).toEqual(["neha", "rahul"]);
    const joined = (await firestore.doc(`families/${fid}/members/rahul`).get()).data();
    expect(joined?.joinedAt.toDate().toISOString()).toBe("2024-11-18T00:40:00.000Z");
    const riya = await addRiya(app, "rahul");
    await firestore.doc(`families/${fid}/items/i1`).set({ forId: riya, date: "2024-11-18" });
    expect((await deleteDependent(request(`/api/dependent/${riya}`, { method: "DELETE", uid: "rahul" }), app.deps, riya)).status).toBe(200);
    expect((await firestore.doc(`families/${fid}/items/i1`).get()).exists).toBe(false);
    expect((await removeMember(request("/api/family/members/rahul", { method: "DELETE", uid: "neha" }), app.deps, "rahul")).status).toBe(
      200,
    );
    expect((await firestore.doc("users/rahul").get()).data()?.removedFrom).toBe("Sharma family");
    expect((await deleteAccount(request("/api/account", { method: "DELETE", uid: "neha" }), app.deps)).status).toBe(200);
    expect((await firestore.doc(`families/${fid}`).get()).exists).toBe(false);
    expect((await firestore.doc(`joinCodes/${code}`).get()).exists).toBe(false);
  });
});
