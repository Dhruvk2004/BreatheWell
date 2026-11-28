import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { evalCases } from "@/ai/eval/planEval";
import { generatePlan, PLAN_BUDGET_MS } from "@/ai/plan/generate";
import { planOutputSchema } from "@/ai/plan/schema";
import { createGeminiModel, failureOf, ModelError, type GenerateClient } from "@/ai/shared/gemini";
import { geminiSchemaOf } from "@/ai/shared/jsonSchema";
import { fakeModel, validReply } from "../../helpers/planReply";

/** Gemini is always mocked: no test calls the real API. */
const check = evalCases()[0].check;
const good = JSON.stringify(validReply(check.request));
const request = { system: "s", prompt: "p", schema: {}, timeoutMs: 1000, temperature: 0.4, maxOutputTokens: 100 };

function client(answer: () => Promise<{ text?: string; candidates?: { finishReason?: string }[] }>) {
  const generateContent = vi.fn<GenerateClient["models"]["generateContent"]>(async () => answer());
  return { client: { models: { generateContent } } as GenerateClient, generateContent };
}

describe("Gemini wrapper (adapted from Utsav)", () => {
  it("asks for JSON with the schema, thinking off and the SDK's retries off", async () => {
    const { client: c, generateContent } = client(async () => ({ text: "{}" }));
    const model = createGeminiModel({ apiKey: "k", model: "gemini-test" }, c);
    expect(model.name).toBe("gemini-test");
    expect(await model.generateJson(request)).toBe("{}");
    const config = generateContent.mock.calls[0][0].config;
    expect(config).toMatchObject({
      systemInstruction: "s",
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 },
      httpOptions: { timeout: 1000, retryOptions: { attempts: 1 } },
    });
  });

  it("turns empty, cut-off and HTTP failures into failure kinds", async () => {
    const run = (answer: () => Promise<{ text?: string; candidates?: { finishReason?: string }[] }>) =>
      createGeminiModel({ apiKey: "k", model: "m" }, client(answer).client).generateJson(request);
    await expect(run(async () => ({ text: "" }))).rejects.toMatchObject({ kind: "empty" });
    await expect(run(async () => ({ text: "{", candidates: [{ finishReason: "MAX_TOKENS" }] }))).rejects.toMatchObject({
      kind: "truncated",
    });
    await expect(run(async () => Promise.reject(Object.assign(new Error("bad"), { status: 400 })))).rejects.toMatchObject({
      kind: "client_error",
      status: 400,
    });
    expect(failureOf(Object.assign(new Error("x"), { status: 503 })).kind).toBe("server_error");
    expect(failureOf(Object.assign(new Error("x"), { status: 408 })).kind).toBe("server_error");
    expect(failureOf(Object.assign(new Error("x"), { status: 429 }))).toMatchObject({ kind: "rate_limited", status: 429 });
    expect(failureOf(Object.assign(new Error("x"), { name: "TimeoutError" })).kind).toBe("timeout");
    expect(failureOf(Object.assign(new Error("x"), { name: "AbortError" })).kind).toBe("timeout");
    expect(failureOf("weird").kind).toBe("server_error");
    const known = new ModelError("empty");
    expect(failureOf(known)).toBe(known);
    expect(known.message).toBe("Gemini call failed: empty");
  });

  it("builds the response schema Gemini accepts, with the dropped limits in words", () => {
    const schema = geminiSchemaOf(z.object({ a: z.string().max(5), b: z.array(z.literal("x")).max(2) }));
    const text = JSON.stringify(schema);
    expect(text).not.toMatch(/maxLength|maxItems|\$schema/);
    expect(text).toContain("At most 5 characters.");
    expect(text).toContain("At most 2 items.");
    expect(text).toContain('"enum":["x"]');
    expect(JSON.stringify(geminiSchemaOf(planOutputSchema))).toContain('"memberId"');
  });
});

describe("plan generation (25 s budget, one retry with 10 s left, none after a 4xx)", () => {
  let now = 0;
  const clock = { advance: (ms: number) => (now += ms) };
  const deps = (model: ReturnType<typeof fakeModel>, reserve = async () => true) => ({ model, now: () => now, reserve });

  it("returns the checked plan from the first good reply", async () => {
    now = 0;
    const model = fakeModel(() => good, clock, 3_000);
    const out = await generatePlan(check, deps(model));
    expect(out).toMatchObject({ outcome: "ok", attempts: 1, latencyMs: 3_000 });
    expect(model.calls[0]).toMatchObject({ timeoutMs: PLAN_BUDGET_MS, temperature: 0.4 });
  });

  it("retries an invalid reply once when 10 s are left, then gives the template", async () => {
    now = 0;
    const replies = ["nope", good];
    const second = await generatePlan(check, deps(fakeModel(() => replies.shift() ?? "", clock, 5_000)));
    expect(second).toMatchObject({ outcome: "ok", attempts: 2 });
    now = 0;
    const twice = await generatePlan(check, deps(fakeModel(() => "nope", clock, 5_000)));
    expect(twice).toMatchObject({ plan: null, outcome: "invalid", attempts: 2 });
  });

  it("does not retry when less than 10 s are left, after a 4xx, or when the quota says no", async () => {
    now = 0;
    expect(await generatePlan(check, deps(fakeModel(() => "nope", clock, 16_000)))).toMatchObject({ attempts: 1, outcome: "invalid" });
    now = 0;
    const fourxx = fakeModel(() => {
      throw new ModelError("client_error", 400);
    });
    expect(await generatePlan(check, deps(fourxx))).toMatchObject({ attempts: 1, outcome: "client_error" });
    const quota = fakeModel(() => good);
    expect(
      await generatePlan(
        check,
        deps(quota, async () => false),
      ),
    ).toMatchObject({ plan: null, outcome: "quota" });
    expect(quota.calls).toHaveLength(0);
  });

  it("retries a timeout or server error and treats unknown throws as server errors", async () => {
    now = 0;
    const errors = [new ModelError("timeout"), new Error("socket")];
    const model = fakeModel(() => {
      throw errors.shift();
    });
    expect(await generatePlan(check, deps(model))).toMatchObject({ attempts: 2, outcome: "server_error" });
  });

  it("finishes inside the budget with a realistic 18 s reply", async () => {
    now = 0;
    const out = await generatePlan(check, deps(fakeModel(() => good, clock, 18_000)));
    expect(out.outcome).toBe("ok");
    expect(out.latencyMs).toBeLessThanOrEqual(PLAN_BUDGET_MS);
  });
});
