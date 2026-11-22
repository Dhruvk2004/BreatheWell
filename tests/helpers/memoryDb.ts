import { encodeTimestamps, type TimestampCodec } from "@/server/db/timestamps";
import type { Db, DocData, DocEntry, Tx, Where } from "@/server/db/types";

/**
 * An in-memory `Db` with Firestore's path, query and transaction semantics (adapted from Utsav):
 * reads before writes, writes buffered until the body resolves, nothing written when it throws,
 * and a re-run when a document read was changed by another commit. Documents are cloned in and out.
 */
const isoCodec: TimestampCodec<string> = {
  fromIso: (iso) => iso,
  isTimestamp: (value: unknown): value is string => typeof value === "symbol",
  toIso: (iso) => iso,
};

export function assertFirestoreValue(value: unknown, path: string): void {
  if (value === undefined) throw new Error(`Cannot use "undefined" as a Firestore value (found in field "${path}")`);
  if (Array.isArray(value)) value.forEach((item, i) => assertFirestoreValue(item, `${path}.${i}`));
  else if (value && typeof value === "object")
    for (const [key, item] of Object.entries(value)) assertFirestoreValue(item, path ? `${path}.${key}` : key);
}

const fieldAt = (data: DocData, path: string): unknown =>
  path.split(".").reduce<unknown>((value, key) => (value && typeof value === "object" ? (value as DocData)[key] : undefined), data);

const MAX_ATTEMPTS = 5;

export class MemoryDb implements Db {
  readonly docs = new Map<string, DocData>();
  private ids = 0;
  private readonly revisions = new Map<string, number>();
  /** Set to make the next transaction or query fail (outage tests). */
  failNext: Error | null = null;

  async get(path: string): Promise<DocData | null> {
    const doc = this.docs.get(path);
    return doc ? structuredClone(doc) : null;
  }

  private children(collection: string): DocEntry[] {
    const prefix = `${collection}/`;
    return [...this.docs.entries()]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
      .map(([path, data]) => ({ id: path.slice(prefix.length), data: structuredClone(data) }));
  }

  async query(collection: string, where: readonly Where[] = []): Promise<DocEntry[]> {
    const matches = (data: DocData, w: Where) =>
      "in" in w ? (w.in as readonly unknown[]).includes(fieldAt(data, w.field)) : fieldAt(data, w.field) === w.value;
    return this.children(collection).filter(({ data }) => where.every((w) => matches(data, w)));
  }

  newId(collection: string): string {
    this.ids += 1;
    return `${collection.split("/").pop()}${this.ids}`;
  }

  async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    if (this.failNext) {
      const error = this.failNext;
      this.failNext = null;
      throw error;
    }
    for (let attempt = 1; ; attempt++) {
      const writes: [string, DocData | null, boolean][] = [];
      const seen = new Map<string, number>();
      const revision = (path: string) => this.revisions.get(path) ?? 0;
      const read = <R>(keys: string[], value: () => Promise<R>): Promise<R> => {
        if (writes.length > 0) throw new Error("Transactions must perform all reads before writes");
        for (const key of keys) if (!seen.has(key)) seen.set(key, revision(key));
        return value();
      };
      const tx: Tx = {
        get: (path) => read([path], () => this.get(path)),
        query: (collection, where) => read([`${collection}/`], () => this.query(collection, where)),
        set: (path, data, options) => {
          const stored = encodeTimestamps(data, isoCodec) as DocData;
          assertFirestoreValue(stored, "");
          writes.push([path, structuredClone(stored), options?.merge ?? false]);
        },
        delete: (path) => void writes.push([path, null, false]),
      };
      const result = await fn(tx);
      const stale = [...seen].some(([key, at]) => revision(key) !== at);
      if (stale && attempt < MAX_ATTEMPTS) continue;
      if (stale) throw new Error("Transaction contention: too many attempts");
      this.commit(writes);
      return result;
    }
  }

  private commit(writes: readonly [string, DocData | null, boolean][]): void {
    for (const [path, data, merge] of writes) {
      if (!data) this.docs.delete(path);
      else this.docs.set(path, merge ? { ...(this.docs.get(path) ?? {}), ...data } : data);
      const bump = (key: string) => this.revisions.set(key, (this.revisions.get(key) ?? 0) + 1);
      bump(path);
      bump(path.slice(0, path.lastIndexOf("/") + 1));
    }
  }

  async deleteTree(path: string): Promise<void> {
    for (const key of [...this.docs.keys()]) if (key === path || key.startsWith(`${path}/`)) this.docs.delete(key);
  }
}
