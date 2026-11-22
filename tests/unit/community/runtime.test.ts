import { describe, expect, it, vi } from "vitest";
import { testApp, type TestApp } from "../../helpers/appDeps";
import { sharmaFamily } from "../../helpers/family";

/** The community page's wiring: the app's deps and the viewer's family home cell. */
let app: TestApp;
let cookie: string | undefined;
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (cookie ? { value: cookie } : undefined) }) }));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/server/runtime", () => ({ appDeps: () => app.deps }));

const runtime = await import("@/server/community/runtime");

describe("community runtime", () => {
  it("uses the app's database, Gemini and the 20-an-hour limiter", () => {
    app = testApp();
    const deps = runtime.communityDeps();
    expect(deps.db).toBe(app.db);
    expect(deps.limiter.limit).toBe(20);
  });

  it("finds whether someone is signed in and their family home cell", async () => {
    app = testApp();
    cookie = undefined;
    expect(await runtime.communityViewer()).toEqual({ signedIn: false, homeCell: null });
    await sharmaFamily(app);
    cookie = "session:neha";
    expect(await runtime.communityViewer()).toEqual({ signedIn: true, homeCell: "28.6_77.2" });
    const { signUp } = await import("../../helpers/family");
    await signUp(app, "loner", "Loner");
    cookie = "session:loner";
    expect(await runtime.communityViewer()).toEqual({ signedIn: true, homeCell: null });
  });
});
