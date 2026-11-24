import { describe, expect, it } from "vitest";
import {
  appOrigin,
  authEmulatorHost,
  DEFAULT_GEMINI_MODEL,
  firebaseProjectId,
  firebaseWebConfig,
  geminiConfig,
  openMeteoTestBase,
  publicEnv,
} from "@/config/env";
import { AUTH_HELPER_HEADERS, CONNECT_HOSTS, csp, firebaseHelperUrl, firebaseHostOf, SECURITY_HEADERS } from "@/server/csp";

describe("environment (setup-steps names)", () => {
  const web = {
    NEXT_PUBLIC_FIREBASE_API_KEY: "k",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "breathewell.vercel.app",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "bw-prod",
    NEXT_PUBLIC_FIREBASE_APP_ID: "app",
  };

  it("works with nothing set", () => {
    expect(firebaseWebConfig({})).toBeNull();
    expect(geminiConfig({})).toBeNull();
    expect(firebaseProjectId({})).toBeNull();
    expect(appOrigin({})).toBeNull();
    expect(Object.keys(publicEnv())).toHaveLength(5);
  });

  it("reads each value, trimmed", () => {
    expect(firebaseWebConfig(web)).toEqual({ apiKey: "k", authDomain: "breathewell.vercel.app", projectId: "bw-prod", appId: "app" });
    expect(firebaseWebConfig({ ...web, NEXT_PUBLIC_FIREBASE_APP_ID: "" })).toBeNull();
    expect(firebaseProjectId({ ...web, FIREBASE_PROJECT_ID: " bw-admin " })).toBe("bw-admin");
    expect(firebaseProjectId(web)).toBe("bw-prod");
    expect(geminiConfig({ GEMINI_API_KEY: "x" })).toEqual({ apiKey: "x", model: DEFAULT_GEMINI_MODEL });
    expect(geminiConfig({ GEMINI_API_KEY: "x", GEMINI_MODEL: "gemini-flash-lite-latest" })?.model).toBe("gemini-flash-lite-latest");
    expect(appOrigin({ APP_ORIGIN: "https://bw.app//" })).toBe("https://bw.app");
  });

  it("uses the Auth emulator only for a demo project on a local host (E2E only)", () => {
    const emu = { ...web, NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:3481" };
    expect(authEmulatorHost(emu)).toBeNull();
    const demo = { ...emu, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-breathewell" };
    expect(authEmulatorHost(demo)).toBe("127.0.0.1:3481");
    expect(firebaseWebConfig(demo)?.emulatorHost).toBe("127.0.0.1:3481");
    expect(authEmulatorHost({ ...demo, NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: "evil.test:80" })).toBeNull();
    expect(authEmulatorHost({})).toBeNull();
    expect(csp({ dev: false, firebaseHost: "", authEmulator: "http://127.0.0.1:3481" })).toContain(
      `${CONNECT_HOSTS.join(" ")} http://127.0.0.1:3481;`,
    );
  });
});

describe("content security policy (spec 11.2)", () => {
  it("allows only our own origin and the listed hosts", () => {
    const policy = csp({ dev: false, firebaseHost: "https://bw-prod.firebaseapp.com" });
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("script-src-attr 'none'");
    expect(policy).toContain(`connect-src 'self' ${CONNECT_HOSTS.join(" ")}`);
    expect(policy).toContain("frame-src 'self' https://accounts.google.com https://bw-prod.firebaseapp.com");
    expect(policy).not.toContain("unsafe-eval");
    expect(csp({ dev: true, firebaseHost: "" })).toContain("'unsafe-eval'");
    expect(csp({ dev: true, firebaseHost: "" })).toContain("frame-src 'self' https://accounts.google.com;");
  });

  it("sends the security headers, with the camera off", () => {
    const headers = Object.fromEntries(SECURITY_HEADERS);
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin-allow-popups");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(Object.fromEntries(AUTH_HELPER_HEADERS)["Content-Security-Policy"]).toContain("frame-ancestors 'self'");
  });

  it("proxies only Firebase's auth helper paths, same-origin (spec 10.4)", () => {
    const host = firebaseHostOf(" bw-prod ");
    expect(host).toBe("https://bw-prod.firebaseapp.com");
    expect(firebaseHostOf(undefined)).toBe("");
    expect(firebaseHelperUrl("/__/auth/handler", "?apiKey=1", host)).toBe("https://bw-prod.firebaseapp.com/__/auth/handler?apiKey=1");
    expect(firebaseHelperUrl("/__/firebase/init.json", "", host)).toBe("https://bw-prod.firebaseapp.com/__/firebase/init.json");
    expect(firebaseHelperUrl("/__/other", "", host)).toBeNull();
    expect(firebaseHelperUrl("/__/auth/handler", "", "")).toBeNull();
  });
});

describe("Open-Meteo stand-in for end-to-end tests", () => {
  it("accepts only a loopback http origin, with an optional one-segment path", () => {
    expect(openMeteoTestBase({})).toBeNull();
    expect(openMeteoTestBase({ OPEN_METEO_TEST_BASE: "http://localhost:3101" })).toBe("http://localhost:3101");
    expect(openMeteoTestBase({ OPEN_METEO_TEST_BASE: "http://127.0.0.1:3101/fail" })).toBe("http://127.0.0.1:3101/fail");
    for (const bad of ["https://evil.example", "http://localhost.evil.example:80", "http://10.0.0.1:3101", "http://localhost:3101/a/b"]) {
      expect(openMeteoTestBase({ OPEN_METEO_TEST_BASE: bad })).toBeNull();
    }
  });
});
