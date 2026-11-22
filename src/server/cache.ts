/**
 * A small in-memory LRU with expiry (per server instance). It serves the air snapshot for a grid
 * hour without a Firestore read, and keeps the last good reading for the "from 4:00 am" state.
 */
export class TtlCache<V> {
  private readonly entries = new Map<string, { value: V; expiresAt: number }>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
    private readonly clock: () => number = Date.now,
  ) {}

  /** The value, or undefined when missing or expired; a hit becomes the most recently used. */
  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    if (entry.expiresAt <= this.clock()) return undefined;
    this.entries.set(key, entry);
    return entry.value;
  }

  /** Forgets a key. */
  delete(key: string): void {
    this.entries.delete(key);
  }

  /** Stores a value, evicting the least recently used entries over the limit. */
  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.clock() + this.ttlMs });
    for (const oldest of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) break;
      this.entries.delete(oldest);
    }
  }
}
