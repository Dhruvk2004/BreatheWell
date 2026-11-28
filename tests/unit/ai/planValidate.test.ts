import { describe, expect, it } from "vitest";
import { evalCases } from "@/ai/eval/planEval";
import { checkField, filled } from "@/ai/plan/fields";
import type { PlanOutput } from "@/ai/plan/schema";
import { allowedTimes, validatePlan } from "@/ai/plan/validate";
import { alternativeById } from "@/domain/libraries/alternatives";
import { validReply } from "../../helpers/planReply";

/** The plan validator and its caps: any failing field falls back to its template. */
const cases = evalCases();
const caseOf = (id: string) => {
  const c = cases.find((x) => x.id === id);
  if (!c) throw new Error(id);
  return c.check;
};
const check = caseOf("two-dependents");
const reply = (): PlanOutput => validReply(check.request);
const run = (out: PlanOutput) => validatePlan(JSON.stringify(out), check);
const kavita = "kavita";

describe("plan validator", () => {
  it("accepts a reply that agrees with the rules and maps it to real ids", () => {
    const plan = run(reply());
    expect(plan?.failed).toBe(0);
    expect(Object.keys(plan?.people ?? {}).sort()).toEqual(["ishaan", kavita, "meera"]);
    expect(plan?.people[kavita].line?.en).toMatch(/^\{m1\}/);
    expect(plan?.home).toHaveLength(1);
    expect(plan?.together?.altId).toBe(check.request.input.together);
  });

  it("rejects broken JSON, the wrong shape and a reply where nothing passes", () => {
    expect(validatePlan("{", check)).toBeNull();
    expect(validatePlan(JSON.stringify({ members: "x" }), check)).toBeNull();
    const nothing = reply();
    nothing.members = [];
    nothing.home = [];
    delete nothing.together;
    expect(run(nothing)).toBeNull();
  });

  it("drops an item whose text leaks an air number, contradicts its rule or has the wrong kind", () => {
    const out = reply();
    const m1 = out.members[0];
    const item = m1.items[0];
    m1.items = [
      { ...item, doThis: { en: "PM2.5 is 210 so take care." } },
      { ...item, kind: item.kind === "indoor" ? "protect" : "indoor" },
      { ...item, activityId: "a99" },
      { ...item, factId: "made_up" },
    ];
    const plan = run(out);
    expect(plan?.people[kavita].items).toEqual({});
    expect(plan?.reasons).toEqual(expect.arrayContaining(["number_leak", "kind_mismatch", "unknown_activity", "unknown_fact"]));
  });

  it("checks the row line against the row's activity and the 45-character cap with the name filled in", () => {
    const out = reply();
    out.members[0].line = { en: "{m1}: take a long, slow and very careful ride to the office today." };
    const plan = run(out);
    expect(plan?.people[kavita].line).toBeNull();
    expect(plan?.reasons).toContain("too_long");
    expect(filled("{m1} and {m7}", check.nameOf)).toBe("Kavita and {m7}");
  });

  it("applies the kid-card checks and fear words to a dependent's text", () => {
    const out = reply();
    const ishaan = out.members.find((m) => m.memberId === "d1");
    if (!ishaan) throw new Error("no d1");
    ishaan.line = { en: "{d1}: wear an N95 and keep the inhaler." };
    const plan = run(out);
    expect(plan?.people.ishaan.line).toBeNull();
    expect(plan?.reasons).toEqual(expect.arrayContaining(["kid_digits", "kid_health"]));
  });

  it("drops a dependent's line with a cigarette comparison and no number in it", () => {
    const out = reply();
    const ishaan = out.members.find((m) => m.memberId === "d1");
    if (!ishaan) throw new Error("no d1");
    ishaan.line = { en: "{d1}: going out today is like smoking." };
    const plan = run(out);
    expect(plan?.people.ishaan.line).toBeNull();
    expect(plan?.reasons).toContain("kid_cigarette");
  });

  it("passes a typical dependent line with a spoken time and 'mask', and fails '15:00', durations and N95", () => {
    const out = reply();
    const d1 = out.members.find((m) => m.memberId === "d1");
    if (!d1) throw new Error("no d1");
    const spec = { cap: "doThis" as const, forDependent: true };
    const ctx = { languages: ["en"] as const, allowedTimes: allowedTimes(check.request), names: check.names, nameOf: check.nameOf };
    const time = check.request.input.members.find((m) => m.id === "d1")?.activities[0].usual ?? "07:00";
    const [hour, minute] = time.split(":").map(Number);
    const spoken = `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, "0")}` : ""} ${hour < 12 ? "am" : "pm"}`;
    expect(checkField({ en: `{d1}: wear a mask on the bus at ${spoken}.` }, spec, ctx).reasons).toEqual([]);
    expect(checkField({ en: `{d1}: leave at ${time}.` }, spec, ctx).reasons).toContain("kid_digits");
    expect(checkField({ en: "{d1}: play inside for 15 minutes." }, spec, ctx).reasons).toContain("kid_digits");
    expect(checkField({ en: "{d1}: wear an N95 mask." }, spec, ctx).reasons).toContain("kid_digits");
    expect(checkField({ en: `{m1}: leave at ${spoken} with an N95.` }, { ...spec, forDependent: false }, ctx).reasons).toEqual([]);
  });

  it("rejects names, unknown tokens, missing languages and the wrong script", () => {
    const spec = { cap: "doThis" as const, forDependent: false };
    const ctx = { languages: ["en", "hi"] as const, allowedTimes: allowedTimes(check.request), names: check.names, nameOf: check.nameOf };
    expect(checkField({ en: "Kavita, take the metro.", hi: "मेट्रो लें।" }, spec, ctx).reasons).toContain("name_leak");
    expect(checkField({ en: "{m5}, take the metro.", hi: "मेट्रो लें।" }, spec, ctx).reasons).toContain("unknown_token");
    expect(checkField({ en: "Take the metro." }, spec, ctx).reasons).toEqual(["missing_language"]);
    expect(checkField({ en: "मेट्रो लें।", hi: "Take the metro." }, spec, ctx).reasons).toContain("wrong_language");
    expect(checkField(undefined, spec, ctx).reasons).toEqual(["missing"]);
    expect(checkField({ en: " Take the metro. ", hi: "मेट्रो लें।" }, spec, ctx).text).toEqual({
      en: "Take the metro.",
      hi: "मेट्रो लें।",
    });
  });

  it("keeps only allowed tips once, the code's together action and swaps code allowed", () => {
    const out = reply();
    const tip = out.home[0];
    out.home = [tip, tip, { ...tip, tipId: "made_up" }, { ...tip, why: { en: "Smoke sits low on cold mornings." } }];
    out.together = { altId: "something_else", doThis: { en: "Plant trees." } };
    out.members[0].swap = { altId: "made_up", doThis: { en: "Swap." } };
    const plan = run(out);
    expect(plan?.home).toHaveLength(1);
    expect(plan?.together).toBeNull();
    expect(plan?.people[kavita].swap).toBeNull();
    expect(plan?.reasons).toContain("unknown_alternative");
  });

  it("keeps a valid swap and why, and drops a why that fails", () => {
    const out = reply();
    const alternatives = check.request.input.members[0].alternatives;
    expect(alternatives.length).toBeGreaterThan(0);
    const swapText = { en: "Take the metro instead of the scooter today." };
    out.members[0].swap = { altId: alternatives[0], doThis: swapText, why: { en: "Fewer fumes on the road." } };
    out.members[0].items[0].why = { en: "It is 300 outside." };
    const plan = run(out);
    expect(plan?.people[kavita].swap).toEqual({
      altId: alternatives[0],
      doThis: swapText,
      why: { en: "Fewer fumes on the road." },
      factId: alternativeById(alternatives[0])?.factId,
    });
    expect(Object.values(plan?.people[kavita].items ?? {})[0]).not.toHaveProperty("why");
  });

  it("allows only the input's times (usual, best and the window ends)", () => {
    const times = allowedTimes(check.request);
    expect(times.length).toBeGreaterThan(2);
    expect(times.every((t) => t.minute === 0 || t.minute === 30)).toBe(true);
  });
});
