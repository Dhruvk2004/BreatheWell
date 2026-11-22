/**
 * The slice of Firestore the server uses, addressed by document path ("families/f1"). The Admin SDK
 * adapter (`src/firebase/firestoreDb.ts`) implements it over Firestore; the tests' `MemoryDb`
 * implements it in memory with the same rules. Timestamps are ISO strings on this side.
 */
export type DocData = Record<string, unknown>;

type Scalar = string | number | boolean | null;

/** An equality filter, or `in` with up to 30 values (Firestore's limit). */
export type Where = { readonly field: string; readonly value: Scalar } | { readonly field: string; readonly in: readonly Scalar[] };

export interface DocEntry {
  readonly id: string;
  readonly data: DocData;
}

/** Reads and writes inside one transaction. All reads happen before the first write. */
export interface Tx {
  get(path: string): Promise<DocData | null>;
  /** The documents of a collection, optionally filtered by equality on fields. */
  query(collection: string, where?: readonly Where[]): Promise<DocEntry[]>;
  /** Replaces a document, or merges into it with `merge`. */
  set(path: string, data: DocData, options?: { merge: boolean }): void;
  delete(path: string): void;
}

export interface Db {
  get(path: string): Promise<DocData | null>;
  query(collection: string, where?: readonly Where[]): Promise<DocEntry[]>;
  /** A new random document id (Firestore's 20-character ids, never derived from a name). */
  newId(collection: string): string;
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  /** Deletes a document and every subcollection under it. */
  deleteTree(path: string): Promise<void>;
}
