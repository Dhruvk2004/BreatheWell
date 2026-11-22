import type { JsonModel } from "@/ai/shared/gemini";
import type { AirDeps } from "./air/service";
import type { SessionAuth, SessionVerifier } from "./auth/session";
import type { Db } from "./db/types";
import { RateLimiter } from "./rateLimit";

/**
 * Everything a signed-in route handler or page loader needs, passed in so they are plain functions
 * of `(request, deps)`. `appDeps()` builds the production set once per server instance; tests build
 * their own with `MemoryDb` and a fake Firebase Auth.
 */
export interface AppDeps {
  /** Null when Firebase is not configured: signed-in routes answer 503, public pages still work. */
  readonly db: Db | null;
  readonly auth: SessionAuth | null;
  readonly sessions: SessionVerifier | null;
  readonly appOrigin: string | null;
  now(): Date;
  /** Secure random bytes (join codes). */
  randomBytes(size: number): Uint8Array;
  /** Waits; join answers take a fixed minimum time so they never hint whether a family exists. */
  pause(ms: number): Promise<void>;
  readonly limits: Limits;
  /** The air service, for the family's home cell (Today, Member plan, progress totals). */
  readonly air: AirDeps;
  /** Gemini, or null without GEMINI_API_KEY (every placement then uses its template). */
  readonly gemini: JsonModel | null;
  log(event: string, fields?: Record<string, string | number | boolean>): void;
}

export interface Limits {
  /** Session create: 10 a minute per IP. */
  readonly session: RateLimiter;
  /** Signed-in writes: 60 a minute per user. */
  readonly mutation: RateLimiter;
  /** The public invite preview on /join/[code]: 30 an hour per IP. */
  readonly invite: RateLimiter;
  /** Breezy questions: 5 a minute per user (spec 7.8). */
  readonly breezy: RateLimiter;
  /** The public community message: 20 an hour per IP (spec 7.8, 11.2). */
  readonly community: RateLimiter;
}

const MINUTE = 60_000;

export function createLimits(clock: () => number = Date.now): Limits {
  return {
    session: new RateLimiter(10, MINUTE, clock),
    mutation: new RateLimiter(60, MINUTE, clock),
    invite: new RateLimiter(30, 60 * MINUTE, clock),
    breezy: new RateLimiter(5, MINUTE, clock),
    community: new RateLimiter(20, 60 * MINUTE, clock),
  };
}

/** The database of a page that already has a signed-in viewer (which needs Firebase configured). */
export function dbOf(deps: Pick<AppDeps, "db">): Db {
  if (!deps.db) throw new Error("Firebase is not configured");
  return deps.db;
}
