import { vi } from "vitest";
import { SessionVerifier, type SessionAuth, type SessionClaims } from "@/server/auth/session";
import { createLimits, type AppDeps } from "@/server/deps";
import { deps as airDeps, NOW } from "./airDeps";
import { MemoryDb } from "./memoryDb";

/**
 * Signed-in route handlers in memory: a `MemoryDb`, a fake Firebase Auth whose ID tokens are
 * "token:<uid>:<name>" and whose session cookies are "session:<uid>", the air helper's clock
 * (18 Nov 2024, 6:10 am IST) and secure random bytes from a counter.
 */
export const ORIGIN = "https://app.test";

export class FakeAuth implements SessionAuth {
  readonly deleted: string[] = [];
  readonly revoked: string[] = [];
  validAfter: Record<string, string> = {};
  authTime = Math.floor(NOW.getTime() / 1000) - 60;

  async verifyIdToken(idToken: string): Promise<SessionClaims> {
    const [kind, uid, name] = idToken.split(":");
    if (kind !== "token" || !uid) throw new Error("bad token");
    return { uid, auth_time: this.authTime, name };
  }
  async createSessionCookie(idToken: string): Promise<string> {
    return `session:${idToken.split(":")[1]}`;
  }
  async verifySessionCookie(cookie: string): Promise<SessionClaims> {
    const [kind, uid] = cookie.split(":");
    if (kind !== "session" || !uid || this.deleted.includes(uid)) throw new Error("bad cookie");
    return { uid, auth_time: this.authTime, name: "Neha Sharma" };
  }
  async getUser(uid: string): Promise<{ tokensValidAfterTime?: string }> {
    if (this.deleted.includes(uid)) throw new Error("no user");
    return { tokensValidAfterTime: this.validAfter[uid] };
  }
  async revokeRefreshTokens(uid: string): Promise<void> {
    this.revoked.push(uid);
  }
  async deleteUser(uid: string): Promise<void> {
    this.deleted.push(uid);
  }
}

export interface TestApp {
  readonly deps: AppDeps;
  readonly db: MemoryDb;
  readonly auth: FakeAuth;
}

export function testApp(over: Partial<AppDeps> = {}): TestApp {
  const db = new MemoryDb();
  const auth = new FakeAuth();
  let seed = 0;
  const deps: AppDeps = {
    db,
    auth,
    sessions: new SessionVerifier(auth, () => NOW.getTime()),
    appOrigin: ORIGIN,
    now: () => NOW,
    randomBytes: (size) => Uint8Array.from({ length: size }, () => (seed = (seed * 37 + 11) % 248)),
    pause: vi.fn(async () => undefined),
    limits: createLimits(() => NOW.getTime()),
    air: airDeps(),
    gemini: null,
    log: vi.fn(),
    ...over,
  };
  return { deps, db, auth };
}

interface Call {
  readonly method?: string;
  readonly uid?: string | null;
  readonly body?: unknown;
  readonly origin?: string | null;
  readonly ip?: string;
}

/** A browser request to the app: JSON body, the session cookie and our own Origin unless told otherwise. */
export function request(path: string, { method = "POST", uid = null, body, origin = ORIGIN, ip = "198.51.100.9" }: Call = {}): Request {
  const headers = new Headers({ "x-forwarded-for": ip });
  if (uid) headers.set("cookie", `__session=session:${uid}`);
  if (origin) headers.set("origin", origin);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${ORIGIN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

export const json = async <T = Record<string, unknown>>(response: Response): Promise<T> => (await response.json()) as T;
