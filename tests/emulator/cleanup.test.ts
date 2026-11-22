import { Timestamp } from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { adminFirestore } from "@/firebase/admin";
import { firestoreSweeper } from "@/firebase/firestoreDb";
import { sweepExpired } from "@/server/cleanup/sweep";

/**
 * The daily clean-up on the emulator (spec 9.4): expired docs go in every group, including nested
 * plan sections, while live docs and a family's own `members` docs (no `expireAt`) stay.
 */
const db = adminFirestore({ FIREBASE_PROJECT_ID: "demo-breathewell", FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST });
const NOW = new Date("2026-11-22T21:30:00.000Z");
const past = Timestamp.fromDate(new Date(NOW.getTime() - 60_000));
const future = Timestamp.fromDate(new Date(NOW.getTime() + 86_400_000));

afterAll(async () => {
  await db?.terminate();
});

beforeEach(async () => {
  if (!db) throw new Error("no emulator Firestore");
  await db.recursiveDelete(db.collection("families"));
  for (const c of ["airCache", "joinCodes", "quota"]) await db.recursiveDelete(db.collection(c));
});

async function seed() {
  if (!db) throw new Error("no emulator Firestore");
  await db.doc("airCache/old").set({ expireAt: past });
  await db.doc("airCache/fresh").set({ expireAt: future });
  await db.doc("joinCodes/OLD123").set({ familyId: "f1", expireAt: past });
  await db.doc("quota/2026-08-01/breezy/u1").set({ count: 3, expireAt: past });
  await db.doc("families/f1").set({ name: "Sharma" });
  await db.doc("families/f1/members/u1").set({ name: "Neha" });
  await db.doc("families/f1/plans/2026-10-01").set({ stale: false, expireAt: past });
  await db.doc("families/f1/plans/2026-10-01/members/m1").set({ line: "x", expireAt: past });
  await db.doc("families/f1/plans/2026-11-22/members/m1").set({ line: "y", expireAt: future });
  await db.doc("families/f1/items/i1").set({ text: "Carry a mask", expireAt: past });
}

const exists = async (path: string) => (await db!.doc(path).get()).exists;

describe("daily clean-up", () => {
  it("deletes only expired docs, across nested groups", async () => {
    await seed();
    const result = await sweepExpired(firestoreSweeper(db!), () => NOW);
    expect(result.complete).toBe(true);
    expect(result.total).toBe(6);
    for (const gone of [
      "airCache/old",
      "joinCodes/OLD123",
      "quota/2026-08-01/breezy/u1",
      "families/f1/plans/2026-10-01",
      "families/f1/plans/2026-10-01/members/m1",
      "families/f1/items/i1",
    ]) {
      expect(await exists(gone), gone).toBe(false);
    }
    for (const kept of ["airCache/fresh", "families/f1", "families/f1/members/u1", "families/f1/plans/2026-11-22/members/m1"]) {
      expect(await exists(kept), kept).toBe(true);
    }
  });

  it("respects the batch limit", async () => {
    await seed();
    expect(await firestoreSweeper(db!).deleteExpired("airCache", NOW, 1)).toBe(1);
    expect(await firestoreSweeper(db!).deleteExpired("airCache", NOW, 10)).toBe(0);
  });
});
