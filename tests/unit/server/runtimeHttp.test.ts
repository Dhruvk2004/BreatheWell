import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { isSameOrigin, readJson } from "@/server/http";
import { createAppDeps } from "@/server/runtime";
import { SessionVerifier } from "@/server/auth/session";
import type * as Gemini from "@/ai/shared/gemini";

/**
 * The production deps when Firebase and Gemini are configured (both faked: no network, no key),
 * and the request helpers' edges: a body with no content type, and the CSRF check without APP_ORIGIN.
 */
const fakes = vi.hoisted(() => ({ firestore: { fake: "firestore" }, auth: { fake: "auth" }, models: [] as unknown[] }));

vi.mock("@/firebase/admin", () => ({ adminFirestore: () => fakes.firestore, adminAuth: () => fakes.auth }));
vi.mock("@/firebase/firestoreDb", () => ({ firestoreDb: (fs: unknown) => ({ wraps: fs }) }));
vi.mock("@/ai/shared/gemini", async (orig) => ({
  ...(await orig<typeof Gemini>()),
  createGeminiModel: (config: unknown) => {
    fakes.models.push(config);
    return { name: "fake", generateJson: vi.fn() };
  },
}));

describe("createAppDeps with Firebase and Gemini configured", () => {
  it("wraps Firestore, verifies sessions with the Admin Auth and builds the Gemini model from the env", () => {
    const deps = createAppDeps({ GEMINI_API_KEY: "placeholder-not-a-key", GEMINI_MODEL: "gemini-test", APP_ORIGIN: "https://x.test/" });
    expect(deps.db).toEqual({ wraps: fakes.firestore });
    expect(deps.auth).toBe(fakes.auth);
    expect(deps.sessions).toBeInstanceOf(SessionVerifier);
    expect(deps.gemini?.name).toBe("fake");
    expect(fakes.models).toEqual([{ apiKey: "placeholder-not-a-key", model: "gemini-test" }]);
    expect(deps.appOrigin).toBe("https://x.test");
  });

  it("has no Gemini without a key", () => {
    expect(createAppDeps({}).gemini).toBeNull();
  });
});

describe("request helpers", () => {
  const schema = z.object({ a: z.number() });

  it("refuses a body sent with no content type at all", async () => {
    const result = await readJson(new Request("https://x.test/api", { method: "POST" }), schema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(415);
  });

  it("accepts application/json with a charset and odd casing", async () => {
    const headers = { "content-type": "Application/JSON; charset=utf-8" };
    const result = await readJson(new Request("https://x.test/api", { method: "POST", headers, body: '{"a":1}' }), schema);
    expect(result).toEqual({ ok: true, data: { a: 1 } });
  });

  it("without APP_ORIGIN compares the Origin to the request's own origin, and refuses a missing Origin", () => {
    const at = (origin: string | null) => new Request("https://app.test/api", { headers: origin ? { origin } : {} });
    expect(isSameOrigin(at("https://app.test"), null)).toBe(true);
    expect(isSameOrigin(at("https://evil.test"), null)).toBe(false);
    expect(isSameOrigin(at(null), null)).toBe(false);
    expect(isSameOrigin(at("https://app.test"), "https://other.test")).toBe(false);
  });
});
