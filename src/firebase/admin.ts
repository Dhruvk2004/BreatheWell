import { applicationDefault, cert, getApps, initializeApp, type App, type Credential } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase-admin/firestore";
import { firebaseProjectId, type Env } from "@/config/env";

/**
 * Firebase Admin SDK for route handlers and server pages (all server writes use it).
 * Credentials: FIREBASE_SERVICE_ACCOUNT_B64 on Vercel (the key JSON, base64), else
 * GOOGLE_APPLICATION_CREDENTIALS locally, else the emulator. Without any of them it returns null and
 * callers carry on without Firestore (the public pages and the demo still work, spec 11).
 */
export function adminCredential(env: Env): Credential | null {
  const b64 = env.FIREBASE_SERVICE_ACCOUNT_B64?.trim();
  if (b64) {
    let key: Record<string, unknown>;
    try {
      key = JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as Record<string, unknown>;
    } catch {
      // Never echo the value.
      throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is not a base64 service-account JSON key");
    }
    const { client_email, private_key, project_id } = key;
    if (typeof client_email !== "string" || typeof private_key !== "string") {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is missing client_email or private_key");
    }
    const projectId = typeof project_id === "string" ? project_id : firebaseProjectId(env);
    if (!projectId) throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 has no project_id and FIREBASE_PROJECT_ID is not set");
    return cert({ clientEmail: client_email, privateKey: private_key, projectId });
  }
  return env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ? applicationDefault() : null;
}

/** True when the Firestore emulator is configured (tests); the SDK then needs no credential. */
const usesEmulator = (env: Env): boolean => Boolean(env.FIRESTORE_EMULATOR_HOST?.trim() || env.FIREBASE_AUTH_EMULATOR_HOST?.trim());

function adminApp(env: Env): App | null {
  const existing = getApps()[0];
  if (existing) return existing;
  const projectId = firebaseProjectId(env);
  if (!projectId) return null;
  const credential = adminCredential(env);
  if (!credential && !usesEmulator(env)) return null;
  const app = initializeApp(credential ? { credential, projectId } : { projectId });
  // REST keeps serverless cold starts small; the emulator needs gRPC.
  initializeFirestore(app, { preferRest: !env.FIRESTORE_EMULATOR_HOST?.trim() });
  return app;
}

/** The server's Firestore, or null when Firebase is not configured. */
export function adminFirestore(env: Env = process.env): Firestore | null {
  const app = adminApp(env);
  return app ? getFirestore(app) : null;
}

/** The server's Firebase Auth (session cookies, account deletion), or null when not configured. */
export function adminAuth(env: Env = process.env): Auth | null {
  const app = adminApp(env);
  return app ? getAuth(app) : null;
}
