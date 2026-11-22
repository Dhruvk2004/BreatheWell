import { Timestamp, type DocumentData, type Firestore, type Query } from "firebase-admin/firestore";
import { decodeTimestamps, encodeTimestamps, type TimestampCodec } from "@/server/db/timestamps";
import type { ExpiredSweeper } from "@/server/cleanup/sweep";
import type { Db, DocData, DocEntry, Tx, Where } from "@/server/db/types";

/**
 * The `Db` interface over the Admin SDK's Firestore: thin delegation plus timestamp conversion.
 * Repositories hold the logic and are unit-tested against `MemoryDb`; this adapter runs in the
 * emulator suite.
 */
const codec: TimestampCodec<Timestamp> = {
  fromIso: (iso) => Timestamp.fromDate(new Date(iso)),
  isTimestamp: (value): value is Timestamp => value instanceof Timestamp,
  toIso: (value) => value.toDate().toISOString(),
};

const encode = (data: DocData) => encodeTimestamps(data, codec) as DocumentData;
const decode = (data: DocumentData | undefined): DocData | null => (data ? (decodeTimestamps(data, codec) as DocData) : null);
const entries = (docs: { id: string; data(): DocumentData }[]): DocEntry[] =>
  docs.map((doc) => ({ id: doc.id, data: decode(doc.data()) ?? {} }));

function filtered(firestore: Firestore, collection: string, where: readonly Where[] = []): Query {
  return where.reduce<Query>(
    (query, w) => ("in" in w ? query.where(w.field, "in", [...w.in]) : query.where(w.field, "==", w.value)),
    firestore.collection(collection),
  );
}

export function firestoreDb(firestore: Firestore): Db {
  return {
    get: async (path) => decode((await firestore.doc(path).get()).data()),
    query: async (collection, where) => entries((await filtered(firestore, collection, where).get()).docs),
    newId: (collection) => firestore.collection(collection).doc().id,
    transaction: (fn) =>
      firestore.runTransaction((transaction) => {
        const tx: Tx = {
          get: async (path) => decode((await transaction.get(firestore.doc(path))).data()),
          query: async (collection, where) => entries((await transaction.get(filtered(firestore, collection, where))).docs),
          set: (path, data, options) => void transaction.set(firestore.doc(path), encode(data), { merge: options?.merge ?? false }),
          delete: (path) => void transaction.delete(firestore.doc(path)),
        };
        return fn(tx);
      }),
    deleteTree: (path) => firestore.recursiveDelete(firestore.doc(path)),
  };
}

/**
 * The daily clean-up's deletes (src/server/cleanup/sweep.ts): a collection-group query on
 * `expireAt` (its index is in firestore.indexes.json) and one batched delete. Only documents that
 * carry `expireAt` can match, so a family's own `members` docs are never touched.
 */
export function firestoreSweeper(firestore: Firestore): ExpiredSweeper {
  return {
    deleteExpired: async (group, before, limit) => {
      const expired = await firestore.collectionGroup(group).where("expireAt", "<", Timestamp.fromDate(before)).limit(limit).get();
      if (expired.empty) return 0;
      const batch = firestore.batch();
      for (const doc of expired.docs) batch.delete(doc.ref);
      await batch.commit();
      return expired.size;
    },
  };
}
