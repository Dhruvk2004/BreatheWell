import { describe, expect, it, vi } from "vitest";

/** The lazy Firebase web SDK wrapper and the browser's one sign-in client, with the SDK mocked. */
const sdk = {
  getAuth: vi.fn(() => ({ name: "auth" })),
  GoogleAuthProvider: vi.fn(function (this: { setCustomParameters: (p: unknown) => void }) {
    this.setCustomParameters = vi.fn();
  }),
  signInWithPopup: vi.fn(async () => ({ user: { getIdToken: async () => "popup-token" } })),
  signInWithRedirect: vi.fn(async () => undefined),
  getRedirectResult: vi.fn(async () => null as null | { user: { getIdToken: () => Promise<string> } }),
  signOut: vi.fn(async () => undefined),
  connectAuthEmulator: vi.fn(),
};
vi.mock("firebase/app", () => ({ getApps: () => [], initializeApp: vi.fn(() => ({ name: "app" })) }));
vi.mock("firebase/auth", () => sdk);

describe("Firebase web SDK wrapper (spec 10.4)", () => {
  it("signs in with a popup or a redirect and asks for an account every time", async () => {
    const { loadGoogleSignIn } = await import("@/firebase/client");
    const google = await loadGoogleSignIn({ apiKey: "k", authDomain: "app.test", projectId: "p", appId: "a" });
    expect(await google.popup()).toBe("popup-token");
    await google.redirect();
    expect(await google.redirectResult()).toBeNull();
    sdk.getRedirectResult.mockResolvedValueOnce({ user: { getIdToken: async () => "redirect-token" } });
    expect(await google.redirectResult()).toBe("redirect-token");
    await google.signOut();
    expect(sdk.signOut).toHaveBeenCalled();
    expect(sdk.connectAuthEmulator).not.toHaveBeenCalled();
  });

  it("connects the Auth emulator once, for the E2E build only", async () => {
    const { loadGoogleSignIn } = await import("@/firebase/client");
    const config = { apiKey: "k", authDomain: "app.test", projectId: "demo-p", appId: "a", emulatorHost: "127.0.0.1:3481" };
    await loadGoogleSignIn(config);
    await loadGoogleSignIn(config);
    expect(sdk.connectAuthEmulator).toHaveBeenCalledTimes(1);
    expect(sdk.connectAuthEmulator).toHaveBeenCalledWith({ name: "auth" }, "http://127.0.0.1:3481", { disableWarnings: true });
  });

  it("gives no client without the web config, and one shared client with it", async () => {
    const { browserAuthClient } = await import("@/client/authRuntime");
    expect(browserAuthClient()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "k");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "app.test");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "p");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_APP_ID", "a");
    const client = browserAuthClient();
    expect(client).not.toBeNull();
    expect(browserAuthClient()).toBe(client);
    vi.unstubAllEnvs();
  });
});
