import { describe, expect, it, vi } from "vitest";
import { ModelError } from "@/ai/shared/gemini";
import { requestPlan } from "@/server/handlers/plan";
import { updateDependent } from "@/server/handlers/dependent";
import { LOCK_MS } from "@/server/repos/plans";
import { deps as airDeps, NOW } from "../../helpers/airDeps";
import { json, request, testApp } from "../../helpers/appDeps";
import { addRiya, joins, RIYA, sharmaFamily } from "../../helpers/family";
import { fakeModel, replyToPrompt } from "../../helpers/planReply";

/** `POST /api/plan` (spec 7.2): generation in the route, the 40 s lock, 3 a day, the global budget. */
const DATE = "2024-11-18";
/** Gemini's quota day for 6:10 am IST on 18 Nov: still 17 Nov in California. */
const QUOTA_DAY = "2024-11-17";

async function family(reply: (prompt: string) => string = replyToPrompt) {
  const model = fakeModel((r) => reply(r.prompt));
  const app = testApp({ gemini: model });
  const { fid, code } = await sharmaFamily(app);
  await joins(app, "rahul", "Rahul", code);
  const riya = await addRiya(app);
  const ask = async (uid = "neha", body: object = {}) =>
    json<{ state: string; retryAfterMs?: number; reason?: string }>(await requestPlan(request("/api/plan", { uid, body }), app.deps));
  return { app, fid, riya, model, ask, planDoc: () => app.db.docs.get(`families/${fid}/plans/${DATE}`) ?? {} };
}

describe("POST /api/plan", () => {
  it("generates, stores the words with their rule snapshots and logs codes only", async () => {
    const { app, fid, riya, ask, planDoc } = await family();
    expect(await ask()).toEqual({ state: "ready" });
    expect(planDoc()).toMatchObject({
      source: "gemini",
      outcome: "ok",
      generations: 1,
      generatingSince: null,
      stale: false,
      languages: ["en"],
    });
    const section = app.db.docs.get(`families/${fid}/plans/${DATE}/members/${riya}`) as { items: Record<string, { rule: object }> };
    expect(Object.values(section.items)[0].rule).toHaveProperty("verdictAtUsual");
    const logged = JSON.stringify(vi.mocked(app.deps.log).mock.calls);
    expect(logged).toContain("plan_generated");
    for (const secret of ["Neha", "Rahul", "Riya", "{m1}"]) expect(logged).not.toContain(secret);
  });

  it("does not generate again while the plan is current; regenerates after a change, up to 3 a day", async () => {
    const { app, riya, model, ask, planDoc } = await family();
    await ask();
    expect(await ask("rahul")).toEqual({ state: "ready" });
    expect(model.calls).toHaveLength(1);
    const edit = async () =>
      updateDependent(request(`/api/dependent/${riya}`, { method: "PUT", uid: "neha", body: { ...RIYA, name: "Riya" } }), app.deps, riya);
    for (const n of [2, 3]) {
      await edit();
      expect(planDoc().stale).toBe(true);
      expect(await ask()).toEqual({ state: "ready" });
      expect(planDoc().generations).toBe(n);
    }
    await edit();
    expect(await ask()).toEqual({ state: "capped" });
    expect(model.calls).toHaveLength(3);
  });

  it("answers busy while another member holds a fresh lock, and takes over a lock older than 40 s", async () => {
    const { app, fid, ask, model } = await family();
    const path = `families/${fid}/plans/${DATE}`;
    app.db.docs.set(path, { generatingSince: new Date(NOW.getTime() - 10_000).toISOString(), generations: 1 });
    expect(await ask()).toEqual({ state: "busy", retryAfterMs: LOCK_MS - 10_000 });
    app.db.docs.set(path, { generatingSince: new Date(NOW.getTime() - LOCK_MS - 1).toISOString(), generations: 1 });
    expect(await ask()).toEqual({ state: "ready" });
    expect(model.calls).toHaveLength(1);
  });

  it("stores a Simple plan when Gemini fails, and Try again generates once more", async () => {
    let fail = true;
    const { ask, planDoc } = await family((prompt) => {
      if (fail) throw new ModelError("client_error", 400);
      return replyToPrompt(prompt);
    });
    expect(await ask()).toEqual({ state: "template" });
    expect(planDoc()).toMatchObject({ source: "template", outcome: "client_error" });
    expect(await ask()).toEqual({ state: "ready" }); // a current Simple plan is kept on open…
    fail = false;
    expect(await ask("neha", { retry: true })).toEqual({ state: "ready" }); // …until Try again
    expect(planDoc()).toMatchObject({ source: "gemini", generations: 2 });
  });

  it("switches to the template at 80% of the daily budget", async () => {
    const { app, ask, model } = await family();
    app.db.docs.set(`quota/${QUOTA_DAY}`, { geminiCalls: 200 });
    expect(await ask()).toEqual({ state: "template" });
    expect(model.calls).toHaveLength(0);
  });

  it("uses the template without Gemini, without air and before 5 am; refuses non-members and bad bodies", async () => {
    const plain = testApp();
    await sharmaFamily(plain);
    expect(await json(await requestPlan(request("/api/plan", { uid: "neha", body: {} }), plain.deps))).toEqual({
      state: "template",
      reason: "not_configured",
    });
    const { app, ask } = await family();
    const earlyNow = () => new Date("2024-11-17T23:00:00.000Z");
    const early = { ...app.deps, now: earlyNow, air: airDeps({ now: earlyNow }) };
    expect(await json(await requestPlan(request("/api/plan", { uid: "neha", body: {} }), early))).toEqual({
      state: "template",
      reason: "too_early",
    });
    const noAir = { ...app.deps, air: airDeps({ fetchAir: async () => ({ ok: false as const, error: "network" as const }) }) };
    expect(await json(await requestPlan(request("/api/plan", { uid: "neha", body: {} }), noAir))).toEqual({
      state: "template",
      reason: "no_air",
    });
    expect((await requestPlan(request("/api/plan", { uid: "stranger", body: {} }), app.deps)).status).toBe(403);
    expect((await requestPlan(request("/api/plan", { uid: "neha", body: { retry: "yes" } }), app.deps)).status).toBe(400);
    expect((await requestPlan(request("/api/plan", { uid: "neha", body: {}, origin: "https://evil.test" }), app.deps)).status).toBe(403);
    expect(await ask("rahul")).toEqual({ state: "ready" });
  });
});
