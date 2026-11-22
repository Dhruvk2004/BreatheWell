import { beforeEach, describe, expect, it, vi } from "vitest";
import { testApp, type TestApp } from "../../helpers/appDeps";
import { sharmaFamily } from "../../helpers/family";

/** The page guards with Next's cookies() and redirect() mocked (they only wire viewer.ts to Next). */
let app: TestApp;
let cookie: string | undefined;
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (cookie ? { value: cookie } : undefined) }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock("@/server/runtime", () => ({ appDeps: () => app.deps }));
vi.mock("next/server", () => ({ connection: async () => undefined }));

const guards = await import("@/server/app/guards");

beforeEach(() => {
  app = testApp();
  cookie = undefined;
});

describe("page guards", () => {
  it("redirect signed-out viewers to Sign-in and families to Today", async () => {
    await expect(guards.requireAccount("/profile")).rejects.toThrow("redirect:/sign-in?next=%2Fprofile");
    await expect(guards.requireSignedOut("/sign-in")).resolves.toEqual({ kind: "signed_out" });
    await sharmaFamily(app);
    cookie = "session:neha";
    expect((await guards.requireFamily("/today")).bundle.family.name).toBe("Sharma family");
    expect((await guards.requireAccount("/profile")).uid).toBe("neha");
    await expect(guards.requireNoFamily("/family/new")).rejects.toThrow("redirect:/today");
    await expect(guards.requireSignedOut("/sign-in")).rejects.toThrow("redirect:/today");
  });
});
