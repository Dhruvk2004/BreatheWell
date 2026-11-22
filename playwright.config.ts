import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const STUB_PORT = Number(process.env.E2E_STUB_PORT ?? 3101);
/** A second app server whose Open-Meteo always fails, for the "Live today" saved-reading fallback. */
export const FALLBACK_PORT = Number(process.env.E2E_FALLBACK_PORT ?? 3102);

/** The test build never takes Firebase web config or a Gemini key: public pages must work without them. */
export const NO_KEYS = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "",
  NEXT_PUBLIC_FIREBASE_APP_ID: "",
  GEMINI_API_KEY: "",
};

const stub = `http://localhost:${STUB_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // The signed-in suite runs against the Firebase emulators: playwright.emulators.config.ts.
  testIgnore: ["signed-in/**"],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Started in order: the Open-Meteo stand-in, the app (built first unless CI built it), then the
  // fallback copy of the same build. The server's Open-Meteo calls never leave the machine.
  webServer: [
    { command: "node e2e/stub/openMeteo.mjs", url: `${stub}/health`, reuseExistingServer: !process.env.CI },
    {
      command: `${process.env.E2E_SKIP_BUILD ? "" : "npm run build && "}npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: { ...NO_KEYS, OPEN_METEO_TEST_BASE: stub, TRUST_PROXY: "1" },
    },
    {
      command: `npx next start -p ${FALLBACK_PORT}`,
      url: `http://localhost:${FALLBACK_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { ...NO_KEYS, OPEN_METEO_TEST_BASE: `${stub}/fail`, TRUST_PROXY: "1" },
    },
  ],
});
