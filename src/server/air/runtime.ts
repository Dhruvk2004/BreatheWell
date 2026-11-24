import { openMeteoTestBase } from "@/config/env";
import { fetchAirQuality, fetchWeather } from "@/data/openMeteo/air";
import { adminFirestore } from "@/firebase/admin";
import { TtlCache } from "../cache";
import { serverClock } from "../clock";
import { RateLimiter } from "../rateLimit";
import type { AirDeps } from "./service";
import type { AirSnapshot } from "./snapshot";
import { firestoreAirStore, type AirStore } from "./store";

const HOUR_MS = 3_600_000;

/** Air now and `/api/air`: 60 requests per hour per IP, in memory. */
export const airLimiter = new RateLimiter(60, HOUR_MS);

/** The Firestore air cache, or null without (or with broken) Admin credentials. */
export function storeFromEnv(connect: typeof adminFirestore = adminFirestore): AirStore | null {
  try {
    const db = connect();
    return db ? firestoreAirStore(db) : null;
  } catch {
    // A broken credential must not take the public pages down; they work without the cache.
    return null;
  }
}

let deps: AirDeps | null = null;

/** The live air dependencies, created once per server instance. */
export function airDeps(): AirDeps {
  const base = openMeteoTestBase(process.env);
  deps ??= {
    fetchAir: (at) => fetchAirQuality(at, { base }),
    fetchWeather: (at) => fetchWeather(at, { base }),
    store: storeFromEnv(),
    memory: new TtlCache<AirSnapshot>(500, HOUR_MS),
    lastGood: new TtlCache<AirSnapshot>(500, 12 * HOUR_MS),
    now: serverClock(process.env),
  };
  return deps;
}
