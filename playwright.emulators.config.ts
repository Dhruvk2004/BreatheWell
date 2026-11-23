import { defineConfig, devices } from "@playwright/test";
import { NO_SERVER_KEYS } from "./playwright.config";

/**
 * Signed-in E2E (spec 11.4, as in Utsav): the production build against the Firebase Auth and
 * Firestore emulators (firebase.e2e.json, ports 3480–3484) and the local Open-Meteo stand-in.
 * Run with `npm run test:e2e:emulators`, which starts the emulators around this config. Sign-in
 * uses the Auth emulator's Google IdP and the real `POST /api/session`; nothing here exists in
 * production. The web config is a placeholder so Sign-in renders its 18+ screen.
 */
const PORT = Number(process.env.E2E_PORT ?? 3110);
const STUB_PORT = Number(process.env.E2E_STUB_PORT ?? 3111);
const BASE_URL = `http://localhost:${PORT}`;
/** A second server on the same build with a Gemini key and the local Gemini stand-in (plan.spec.ts). */
const PLAN_PORT = Number(process.env.E2E_PLAN_PORT ?? 3112);
const PLAN_URL = `http://localhost:${PLAN_PORT}`;
process.env.E2E_BASE_URL = BASE_URL;

/** The app server's environment: emulators, placeholder web config, Open-Meteo stand-in. */
function serverEnv(origin: string, extra: Record<string, string>): Record<string, string> {
  return {
    ...NO_SERVER_KEYS,
    FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:3480",
    FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:3481",
    FIREBASE_PROJECT_ID: "demo-breathewell",
    NEXT_PUBLIC_FIREBASE_API_KEY: "e2e-placeholder",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: new URL(origin).host,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-breathewell",
    NEXT_PUBLIC_FIREBASE_APP_ID: "e2e-placeholder",
    // Emulator-only: the real Continue button signs in through the Auth emulator's Google page.
    NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:3481",
    APP_ORIGIN: origin,
    OPEN_METEO_TEST_BASE: `http://localhost:${STUB_PORT}`,
    METADATA_SERVER_DETECTION: "none",
    // The suites set X-Forwarded-For per test, as a trusted proxy would (stage 7 WEB-3).
    TRUST_PROXY: "1",
    ...extra,
  };
}

export default defineConfig({
  testDir: "./e2e/signed-in",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never", outputFolder: "playwright-report-emulators" }]] : "list",
  use: { baseURL: BASE_URL, trace: process.env.CI ? "retain-on-failure" : "off" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /plan\.spec\.ts/ },
    { name: "plan", use: { ...devices["Desktop Chrome"], baseURL: PLAN_URL }, testMatch: /plan\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /a11y\.spec\.ts/ },
  ],
  webServer: [
    {
      command: "node e2e/stub/openMeteo.mjs",
      url: `http://localhost:${STUB_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      env: { E2E_STUB_PORT: String(STUB_PORT) },
    },
    {
      command: `${process.env.E2E_SKIP_BUILD ? "" : "npm run build && "}npx next start -p ${PORT}`,
      url: `${BASE_URL}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: serverEnv(BASE_URL, { GEMINI_API_KEY: "" }),
    },
    {
      // Starts after the first server's build, on the same .next output.
      command: `npx next start -p ${PLAN_PORT}`,
      url: `${PLAN_URL}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: serverEnv(PLAN_URL, {
        GEMINI_API_KEY: "e2e-stub-key",
        GEMINI_MODEL: "gemini-e2e",
        GEMINI_TEST_BASE: `http://localhost:${STUB_PORT}/gemini`,
        // Test-only fixed time of day (src/server/clock.ts): plans start at 5 am IST, so plan.spec.ts runs at any hour.
        E2E_IST_CLOCK: "10:00",
        // The stand-in has no per-minute limit; plans then keep their 3 calls without starving Breezy.
        E2E_GEMINI_RPM: "100",
      }),
    },
  ],
});
