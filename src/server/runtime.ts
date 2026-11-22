import { createHash, randomBytes } from "node:crypto";
import { createGeminiModel } from "@/ai/shared/gemini";
import { appOrigin, geminiConfig } from "@/config/env";
import { adminAuth, adminFirestore } from "@/firebase/admin";
import { firestoreDb } from "@/firebase/firestoreDb";
import { airDeps } from "./air/runtime";
import { SessionVerifier, type SessionAuth } from "./auth/session";
import { serverClock } from "./clock";
import { createLimits, type AppDeps } from "./deps";

type Env = Readonly<Record<string, string | undefined>>;

/** Structured JSON logs: uids are hashed; names, health and free text are never logged (spec 7.1 item 5). */
export function jsonLog(event: string, fields: Record<string, string | number | boolean> = {}): void {
  const { uid, ...rest } = fields;
  const uidHash = typeof uid === "string" ? createHash("sha256").update(uid).digest("hex").slice(0, 16) : undefined;
  console.log(JSON.stringify({ severity: "INFO", message: event, ...(uidHash ? { uidHash } : {}), ...rest }));
}

/** Firebase services, or nulls when not configured or the credential is broken (public pages keep working). */
function firebase(env: Env) {
  try {
    const firestore = adminFirestore(env);
    const auth = adminAuth(env) as SessionAuth | null;
    return { db: firestore ? firestoreDb(firestore) : null, auth };
  } catch {
    return { db: null, auth: null };
  }
}

/** The production deps from the environment. */
export function createAppDeps(env: Env): AppDeps {
  const { db, auth } = firebase(env);
  const gemini = geminiConfig(env);
  return {
    db,
    auth,
    sessions: auth ? new SessionVerifier(auth) : null,
    appOrigin: appOrigin(env),
    now: serverClock(env),
    randomBytes: (size) => new Uint8Array(randomBytes(size)),
    pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    limits: createLimits(),
    air: airDeps(),
    gemini: gemini ? createGeminiModel(gemini) : null,
    log: jsonLog,
  };
}

const SHARED = Symbol.for("breathewell.app.deps");

/**
 * One copy per server process on `globalThis`: Next bundles route handlers and pages separately,
 * and both must count the same rate limits and share the revocation cache.
 */
export function appDeps(): AppDeps {
  const holder = globalThis as typeof globalThis & { [SHARED]?: AppDeps };
  holder[SHARED] ??= createAppDeps(process.env);
  return holder[SHARED];
}
