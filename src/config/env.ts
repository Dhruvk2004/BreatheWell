/**
 * Deployment configuration (the names are listed in .env.example). Every reader is a pure function of an
 * env object, so the app builds and serves its public pages and the demo with nothing set: callers
 * get null and show a "not configured" state instead of crashing.
 */
export type Env = Readonly<Record<string, string | undefined>>;

/** Firebase web config. Public by design; `authDomain` is the app host. */
export interface FirebaseWebConfig {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly projectId: string;
  readonly appId: string;
  /** Emulator tests only: the Auth emulator's `host:port` (see `authEmulatorHost`). */
  readonly emulatorHost?: string;
}

const value = (env: Env, key: string): string | null => env[key]?.trim() || null;

/**
 * The `NEXT_PUBLIC_*` values, each referenced literally so Next.js inlines it into the client bundle.
 */
export function publicEnv(): Env {
  return {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST,
  };
}

/** The web config when all four values are set, otherwise null (sign-in is then unavailable). */
export function firebaseWebConfig(env: Env): FirebaseWebConfig | null {
  const apiKey = value(env, "NEXT_PUBLIC_FIREBASE_API_KEY");
  const authDomain = value(env, "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  const projectId = value(env, "NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  const appId = value(env, "NEXT_PUBLIC_FIREBASE_APP_ID");
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  const emulatorHost = authEmulatorHost(env);
  return { apiKey, authDomain, projectId, appId, ...(emulatorHost ? { emulatorHost } : {}) };
}

const HOST_PORT = /^(localhost|127\.0\.0\.1):\d{2,5}$/;

/**
 * The web SDK's Auth emulator, for the signed-in E2E only (`playwright.emulators.config.ts`): set
 * by `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST`, honoured only for a `demo-*` project (Firebase's
 * emulator-only projects, which cannot reach real accounts) and a local `host:port`. Not one of
 * the deployment variables, and never set on Vercel.
 */
/** A Firebase "demo-" project exists only on the emulators, so test-only hooks may switch on. */
export const isDemoProject = (projectId: string | null | undefined): boolean => projectId?.startsWith("demo-") ?? false;

export function authEmulatorHost(env: Env): string | null {
  const host = value(env, "NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST");
  const demo = isDemoProject(value(env, "NEXT_PUBLIC_FIREBASE_PROJECT_ID"));
  return host && demo && HOST_PORT.test(host) ? host : null;
}

/** Server-side Firebase project: FIREBASE_PROJECT_ID, then the web config's id. */
export const firebaseProjectId = (env: Env): string | null =>
  value(env, "FIREBASE_PROJECT_ID") ?? value(env, "NEXT_PUBLIC_FIREBASE_PROJECT_ID");

/**
 * The default model, pinned to a versioned stable ID so evals and validator pass rates do
 * not drift: `gemini-flash-latest` is an alias Google hot-swaps with every release. `gemini-3.8-flash`
 * is listed as Stable and free of charge on the AI Studio models and pricing pages (checked 20 Nov 2026).
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export interface GeminiConfig {
  readonly apiKey: string;
  readonly model: string;
  /** End-to-end tests only: the local Gemini stand-in (see `localTestBase`). */
  readonly baseUrl?: string;
}

/** Gemini settings, or null without a key (every placement then uses its template). */
export function geminiConfig(env: Env): GeminiConfig | null {
  const apiKey = value(env, "GEMINI_API_KEY");
  if (!apiKey) return null;
  const baseUrl = localTestBase(env, "GEMINI_TEST_BASE");
  return { apiKey, model: value(env, "GEMINI_MODEL") ?? DEFAULT_GEMINI_MODEL, ...(baseUrl ? { baseUrl } : {}) };
}

/** The public origin (for links in share texts and the CSRF origin check), or null. */
export const appOrigin = (env: Env): string | null => value(env, "APP_ORIGIN")?.replace(/\/+$/, "") ?? null;

/**
 * End-to-end tests only: a local stand-in for an outside API (`e2e/stub/openMeteo.mjs`), so the
 * browser tests never depend on the network. Anything but a loopback http URL is ignored, so a
 * deploy can never be pointed elsewhere by these variables. Not in the deploy list.
 */
function localTestBase(env: Env, key: string): string | null {
  const base = value(env, key);
  return base && /^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}(\/[\w-]+)?$/.test(base) ? base : null;
}

/** Both Open-Meteo hosts' stand-in (`playwright.config.ts` sets it). */
export const openMeteoTestBase = (env: Env): string | null => localTestBase(env, "OPEN_METEO_TEST_BASE");

/**
 * `CRON_SECRET`, the shared secret Vercel Cron sends to `/api/cron/cleanup`. Set it on Vercel only
 * (any long random string); without it the clean-up route refuses every call.
 */
export const cronSecret = (env: Env): string | null => value(env, "CRON_SECRET");
