import { describe, expect, it } from "vitest";
import { FIRST_CALL_MIN_MS, PLAN_BUDGET_MS } from "@/ai/plan/generate";
import type { AirDeps } from "@/server/air/service";
import { requestPlan } from "@/server/handlers/plan";
import { tickProgress } from "@/server/handlers/progress";
import { deps as airDeps, NOW } from "../../helpers/airDeps";
import { json, request, testApp } from "../../helpers/appDeps";
import { joins, sharmaFamily } from "../../helpers/family";
import { fakeModel, replyToPrompt } from "../../helpers/planReply";

/**
 * Review fixes for `POST /api/plan` (spec 7.2): the 25 s budget counts from the request start, a
 * failed save gives the lock and the day's count back; and the Swap card's tick (F13, F21).
 */
const DATE = "2024-11-18";

/** A family whose air fetch takes `airMs` and whose model takes `modelMs`, on one fake clock. */
async function slowFamily(airMs: number, modelMs: number) {
  let now = NOW.getTime();
  const clock = { advance: (ms: number) => void (now += ms) };
  const nowFn = () => new Date(now);
  const base = airDeps({ now: nowFn });
  const air: AirDeps = {
    ...base,
    fetchAir: async (...args: Parameters<AirDeps["fetchAir"]>) => {
      clock.advance(airMs);
      return base.fetchAir(...args);
    },
  };
  const model = fakeModel((r) => replyToPrompt(r.prompt), clock, modelMs);
  const app = testApp({ gemini: model, now: nowFn, air });
  const { fid, code } = await sharmaFamily(app);
  await joins(app, "rahul", "Rahul", code);
  const ask = async () => json<{ state: string }>(await requestPlan(request("/api/plan", { uid: "neha", body: {} }), app.deps));
  return { app, model, ask, planDoc: () => app.db.docs.get(`families/${fid}/plans/${DATE}`) ?? {} };
}

describe("POST /api/plan budget and lock", () => {
  it("gives Gemini only what is left of 25 s after a slow air fetch, and still saves", async () => {
    const { ask, model, planDoc } = await slowFamily(8_000, 12_000);
    expect(await ask()).toEqual({ state: "ready" });
    expect(model.calls[0].timeoutMs).toBe(PLAN_BUDGET_MS - 8_000);
    expect(planDoc()).toMatchObject({ source: "gemini", generatingSince: null, generations: 1 });
  });

  it("does not call Gemini when too little of the budget is left, and saves a Simple plan", async () => {
    const { ask, model, planDoc } = await slowFamily(PLAN_BUDGET_MS - FIRST_CALL_MIN_MS + 1, 0);
    expect(await ask()).toEqual({ state: "template" });
    expect(model.calls).toHaveLength(0);
    expect(planDoc()).toMatchObject({ source: "template", outcome: "timeout", generatingSince: null });
  });

  it("releases the lock and the day's count when saving fails", async () => {
    const { app, model, ask, planDoc } = await slowFamily(0, 0);
    const reply = model.generateJson.bind(model);
    model.generateJson = async (r) => {
      app.db.failNext = new Error("Firestore down"); // the next transaction is the save
      return reply(r);
    };
    await expect(ask()).rejects.toThrow("Firestore down");
    expect(planDoc()).toMatchObject({ generatingSince: null, generations: 0 });
    model.generateJson = reply;
    expect(await ask()).toEqual({ state: "ready" });
    expect(planDoc()).toMatchObject({ source: "gemini", generations: 1 });
  });
});

describe("Swap card tick (F13, F21)", () => {
  it("accepts a swap code allows today and counts its CO₂ and car trips; refuses any other swap", async () => {
    const { app } = await slowFamily(0, 0);
    const tick = async (key: string, done = true) =>
      tickProgress(request("/api/progress", { uid: "neha", body: { forId: "neha", key, done } }), app.deps);
    const swap = await json<{ done: string[]; co2AvoidedKg: number }>(await tick("swap:metro_for_scooter"));
    expect(swap.done).toEqual(["swap:metro_for_scooter"]);
    expect(swap.co2AvoidedKg).toBeGreaterThan(0);
    expect((await tick("swap:made_up")).status).toBe(400);
    expect(await json(await tick("swap:metro_for_scooter", false))).toMatchObject({ done: [], co2AvoidedKg: 0, carTrips: 0 });
  });
});
