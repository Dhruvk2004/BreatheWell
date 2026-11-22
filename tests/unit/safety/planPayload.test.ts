import { describe, expect, it } from "vitest";
import { loadCommunityPage } from "@/server/community/page";
import { requestPlan } from "@/server/handlers/plan";
import { RateLimiter } from "@/server/rateLimit";
import { deps as airDeps, NOW } from "../../helpers/airDeps";
import { json, request } from "../../helpers/appDeps";
import { MemoryDb } from "../../helpers/memoryDb";
import { fakeModel, replyToPrompt } from "../../helpers/planReply";
import { INJECTED_PLACE, leaks, safetyFamily } from "../../helpers/safetyFamily";

/**
 * The plan and community prompts (spec 7.1, 7.2, 7.6): no name, name word, uid, condition name or
 * typed place reaches Gemini, a reply that uses a name is never stored as Gemini's words, and the
 * URL's place name (an injected instruction) never reaches the community prompt.
 */
describe("plan payload", () => {
  it("has tokens, roles and care tags only: no names, uids, health ticks or the typed home name", async () => {
    const family = await safetyFamily((r) => replyToPrompt(r.prompt));
    expect(await json(await requestPlan(request("/api/plan", { uid: "neha", body: {} }), family.app.deps))).toEqual({ state: "ready" });
    expect(family.calls).toHaveLength(1);
    const [call] = family.calls;
    expect(leaks(call)).toEqual([]);
    for (const id of [family.riya, family.aarav]) expect(call.prompt).not.toContain(id);
    expect(call.prompt).not.toMatch(/"name"\s*:/u);
    expect(call.prompt).toMatch(/"care":"extra"/u);
  });

  it("a reply that names a person is not stored as Gemini's words for that person", async () => {
    const family = await safetyFamily((r) => replyToPrompt(r.prompt).replace(/\{m1\}/gu, "Neha"));
    await requestPlan(request("/api/plan", { uid: "neha", body: {} }), family.app.deps);
    const stored = [...family.app.db.docs.entries()].filter(([path]) => path.includes("/plans/"));
    expect(stored.length).toBeGreaterThan(0);
    expect(JSON.stringify(stored)).not.toMatch(/Neha/u);
  });
});

describe("community payload", () => {
  it("never sends the place name from the URL, even an instruction", async () => {
    const model = fakeModel(() => "{}");
    const deps = {
      db: new MemoryDb(),
      gemini: model,
      now: () => NOW,
      log: () => undefined,
      air: airDeps(),
      limiter: new RateLimiter(20, 3_600_000),
    };
    const page = await loadCommunityPage(
      { place: INJECTED_PLACE, lat: "28.56", lon: "77.21" },
      new Headers({ "x-forwarded-for": "198.51.100.7" }),
      deps,
    );
    expect(page.kind).toBe("ready");
    expect(model.calls.length).toBeGreaterThan(0);
    for (const call of model.calls) expect(JSON.stringify(call).toLowerCase()).not.toContain("ignore previous");
  });
});
