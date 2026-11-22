/**
 * The server keeps timestamps as ISO strings; Firestore stores them as `Timestamp`, so the daily
 * clean-up's range query on `expireAt` works (spec 9.4). Conversion is by field name, never by the shape of a string, so a
 * name that happens to look like a date stays text.
 */
export const TIMESTAMP_FIELDS: ReadonlySet<string> = new Set([
  "createdAt",
  "updatedAt",
  "expireAt",
  "expiresAt",
  "adultConfirmedAt",
  "joinedAt",
  "doneAt",
  "at",
  "windowStart",
  "dayStart",
  "generatedAt",
  "generatingSince",
]);

export interface TimestampCodec<T> {
  fromIso(iso: string): T;
  isTimestamp(value: unknown): value is T;
  toIso(value: T): string;
}

function mapValues(value: unknown, fn: (key: string, child: unknown) => unknown): unknown {
  if (Array.isArray(value)) return value.map((child) => mapValues(child, fn));
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, fn(key, child)]));
}

/** Drops `undefined` fields, which Firestore refuses to store. */
function definedEntries(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined));
}

/** ISO strings in timestamp fields become database timestamps, at any depth. */
export function encodeTimestamps<T>(value: unknown, codec: TimestampCodec<T>): unknown {
  if (Array.isArray(value)) return value.map((child) => encodeTimestamps(child, codec));
  return mapValues(definedEntries(value), (key, child) =>
    TIMESTAMP_FIELDS.has(key) && typeof child === "string" ? codec.fromIso(child) : encodeTimestamps(child, codec),
  );
}

/** Database timestamps become ISO strings, wherever they are. */
export function decodeTimestamps<T>(value: unknown, codec: TimestampCodec<T>): unknown {
  if (codec.isTimestamp(value)) return codec.toIso(value);
  return mapValues(value, (_key, child) => decodeTimestamps(child, codec));
}
