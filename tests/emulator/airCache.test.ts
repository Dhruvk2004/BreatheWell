import { initializeTestEnvironment, assertFails } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { doc, getDoc } from "firebase/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { adminFirestore } from "@/firebase/admin";
import { cacheDocId } from "@/server/air/snapshot";
import { firestoreAirStore } from "@/server/air/store";
import { NOW, snapshot } from "../helpers/airDeps";

/**
 * The air cache on the emulator (spec 9.1, 11.3): the server writes `airCache/{gridId}_{hour}` with
 * the Admin SDK and reads it back; no client can read it (rules default deny).
 */
const db = adminFirestore({ FIREBASE_PROJECT_ID: "demo-breathewell", FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST });

afterAll(async () => {
  await db?.terminate();
});

describe("airCache", () => {
  it("round-trips a snapshot through Firestore with its expiry", async () => {
    if (!db) throw new Error("no emulator Firestore");
    const store = firestoreAirStore(db);
    await store.put(snapshot());
    expect(await store.get("28.6_77.2", NOW)).toEqual(snapshot());
    const raw = (await db.collection("airCache").doc(cacheDocId("28.6_77.2", NOW)).get()).data();
    expect(raw?.expireAt.toDate().getTime() - NOW.getTime()).toBe(48 * 3_600_000);
  });

  it("is never readable by a client, signed in or not", async () => {
    const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:3480").split(":");
    const env = await initializeTestEnvironment({
      projectId: "demo-breathewell",
      firestore: { rules: readFileSync("firestore.rules", "utf8"), host, port: Number(port) },
    });
    for (const client of [env.unauthenticatedContext().firestore(), env.authenticatedContext("u1").firestore()]) {
      await assertFails(getDoc(doc(client, "airCache", cacheDocId("28.6_77.2", NOW))));
    }
    await env.cleanup();
  });
});
