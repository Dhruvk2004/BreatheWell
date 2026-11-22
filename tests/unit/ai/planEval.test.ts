import { describe, expect, it } from "vitest";
import { evalCases, evalReport, percentile, runPlanEval } from "@/ai/eval/planEval";
import { evalKey } from "@/ai/eval/evalKey";
import { EVAL_FAMILIES } from "@/ai/eval/families";
import { ModelError } from "@/ai/shared/gemini";
import { DEFAULT_GEMINI_MODEL } from "@/config/env";
import { validatePlan } from "@/ai/plan/validate";
import { fakeModel, validReply } from "../../helpers/planReply";

describe("plan eval harness (spec 11.4, mocked)", () => {
  const cases = evalCases();

  it("builds all 10 fixture families, incl. two dependents, a 60+ Hindi speaker, 10 people and a Severe day", () => {
    expect(EVAL_FAMILIES).toHaveLength(10);
    expect(cases).toHaveLength(10);
    const ten = cases.find((c) => c.id === "ten-people");
    expect(ten?.check.request.input.members.filter((m) => m.id.startsWith("d"))).toHaveLength(4);
    expect(ten?.check.request.input.members.filter((m) => m.id.startsWith("m"))).toHaveLength(6);
    const severe = cases.find((c) => c.id === "severe-day")?.check.request.input;
    expect(severe?.members.some((m) => m.activities.some((a) => a.rule.suggestion === "indoor"))).toBe(true);
    const hindi = cases.find((c) => c.id === "hindi-grandparent")?.check.request.input;
    expect(hindi?.languages).toEqual(["hi"]);
    expect(hindi?.members[0]).toMatchObject({ role: "grandparent", ageGroup: "60plus", care: "extra", language: "hi" });
  });

  it("sends no name in any case", () => {
    for (const c of cases) {
      const payload = JSON.stringify(c.check.request.input);
      for (const name of c.check.names) expect(payload.toLowerCase()).not.toContain(name.toLowerCase());
    }
  });

  it("the test reply helper passes the validator for every family", () => {
    for (const c of cases) {
      const plan = validatePlan(JSON.stringify(validReply(c.check.request)), c.check);
      expect(plan?.failed, `${c.id}: ${plan?.reasons.join(",")}`).toBe(0);
    }
  });

  it("reports pass rate, fallbacks and latency for a run with a fake model", async () => {
    let now = 0;
    const clock = { advance: (ms: number) => (now += ms) };
    const model = fakeModel(
      (req) => {
        const c = cases.find((x) => req.prompt.includes(JSON.stringify(x.check.request.input)));
        return c && c.id !== "solo-commuter" ? JSON.stringify(validReply(c.check.request)) : "not json";
      },
      clock,
      4_000,
    );
    const sleeps: number[] = [];
    const report = await runPlanEval(cases, model, () => now, { rpm: 10, sleep: async (ms) => void sleeps.push(ms) });
    expect(report.cases).toBe(10);
    expect(report.rateLimited).toBe(0);
    // 6 s per call at 10 RPM; the invalid case was retried once, so the next case waits for both calls.
    expect(sleeps).toHaveLength(9);
    expect(sleeps.every((ms) => ms === 6_000 || ms === 12_000)).toBe(true);
    expect(sleeps).toContain(12_000);
    expect(report.okRate).toBe(0.9);
    expect(report.fallbackRate).toBeCloseTo(0.1);
    expect(report.fieldPassRate).toBe(1);
    expect(report.p50Ms).toBe(4_000);
    expect(report.p95Ms).toBe(8_000);
    expect(report.reasons.invalid).toBe(1);
    expect(report.meetsTarget).toBe(true);
  });

  it("reports 429s as rate_limited, outside the model's rates, and then misses the target", async () => {
    const model = fakeModel((req) => {
      if (req.prompt.includes('"date"') && model.calls.length === 1) throw new ModelError("rate_limited", 429);
      const c = cases.find((x) => req.prompt.includes(JSON.stringify(x.check.request.input)));
      return JSON.stringify(validReply(c?.check.request ?? cases[0].check.request));
    });
    const report = await runPlanEval(cases.slice(0, 3), model, () => 0, { rpm: 60, sleep: async () => undefined });
    expect(report).toMatchObject({ cases: 3, rateLimited: 1, okRate: 1, fallbackRate: 0, meetsTarget: false });
    expect(report.reasons.rate_limited).toBe(1);
    expect(model.calls).toHaveLength(3); // a 429 is never retried
  });

  it("uses its own key and refuses the production one (spec 7.8)", () => {
    expect(evalKey({})).toEqual({ ok: false, reason: "missing" });
    expect(evalKey({ GEMINI_EVAL_API_KEY: "k1", GEMINI_API_KEY: " k1 " })).toEqual({ ok: false, reason: "same_as_production" });
    expect(evalKey({ GEMINI_EVAL_API_KEY: "k2", GEMINI_API_KEY: "k1" })).toMatchObject({
      ok: true,
      apiKey: "k2",
      model: DEFAULT_GEMINI_MODEL,
    });
    expect(evalKey({ GEMINI_EVAL_API_KEY: "k2", GEMINI_MODEL: "m" })).toMatchObject({ model: "m" });
  });

  it("an empty run misses the target; percentiles use the nearest rank", () => {
    expect(evalReport([])).toMatchObject({ cases: 0, okRate: 0, fallbackRate: 0, fieldPassRate: 0, meetsTarget: false });
    expect(percentile([], 50)).toBe(0);
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile([5, 1, 3, 2, 4], 95)).toBe(5);
  });
});
