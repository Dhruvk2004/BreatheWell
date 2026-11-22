import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { cacheDocId, fromCacheDoc, toCacheDoc, type AirSnapshot } from "./snapshot";

/** Where air snapshots persist between server instances: `airCache` in Firestore (spec 9.1, 11.3). */
export interface AirStore {
  /** The snapshot cached for this grid cell and UTC hour, or null. */
  get(gridId: string, at: Date): Promise<AirSnapshot | null>;
  put(snapshot: AirSnapshot): Promise<void>;
}

/** Firestore Timestamps back to Dates, so the stored document parses with the shared schema. */
function withDates(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value instanceof Timestamp ? value.toDate() : value]));
}

/** The Firestore air store. Only the server touches `airCache`; the rules deny every client. */
export function firestoreAirStore(db: Firestore): AirStore {
  const collection = db.collection("airCache");
  return {
    async get(gridId, at) {
      const doc = await collection.doc(cacheDocId(gridId, at)).get();
      const data = doc.data();
      return data ? fromCacheDoc(withDates(data)) : null;
    },
    async put(snapshot) {
      await collection.doc(cacheDocId(snapshot.gridId, snapshot.fetchedAt)).set(toCacheDoc(snapshot));
    },
  };
}
