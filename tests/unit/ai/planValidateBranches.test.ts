import { describe, expect, it } from "vitest";
import type { PlanOutput } from "@/ai/plan/schema";
import { allowedTimes, validatePlan, type PlanCheck } from "@/ai/plan/validate";
import { alternativeById } from "@/domain/libraries/alternatives";
import { validReply } from "../../helpers/planReply";
import { checkOf, sourceOf } from "../../helpers/planSource";

/**
 * The plan validator's field-level fallbacks (spec 7.1): each `why`, fact and swap passes or falls
 * back on its own, and an item that fails never takes a good item's place.
 */
const check = checkOf(sourceOf());
const run = (out: PlanOutput, c: PlanCheck = check) => validatePlan(JSON.stringify(out), c);
const GOOD_WHY = { en: "Morning air sits low, so it is worse early." };
const BAD_WHY = { en: "PM2.5 is 310 this morning." };
const m1 = (out: PlanOutput) => out.members[0];

describe("plan validator: why, facts and home tips", () => {
  it("keeps a passing item why and an allowed fact on the item", () => {
    const out = validReply(check.request);
    m1(out).items[0] = { ...m1(out).items[0], why: GOOD_WHY, factId: "n95_fit" };
    const words = run(out)?.people.kavita.items.office_trip;
    expect(words).toMatchObject({ why: GOOD_WHY, factId: "n95_fit" });
  });

  it("drops a failing item why but keeps its doThis", () => {
    const out = validReply(check.request);
    m1(out).items[0] = { ...m1(out).items[0], why: BAD_WHY };
    const plan = run(out);
    expect(plan?.people.kavita.items.office_trip.why).toBeUndefined();
    expect(plan?.people.kavita.items.office_trip.doThis).toBeDefined();
    expect(plan?.reasons).toContain("number_leak");
  });

  it("keeps a home tip's passing why and drops a tip whose doThis fails", () => {
    const out = validReply(check.request);
    const [first, second] = check.request.input.allowedTips;
    out.home = [
      { tipId: first, doThis: { en: "Keep the windows shut this morning." }, why: GOOD_WHY },
      { tipId: second, doThis: { en: "AQI 400 now, so shut it all." } },
    ];
    expect(run(out)?.home).toEqual([{ tipId: first, doThis: { en: "Keep the windows shut this morning." }, why: GOOD_WHY }]);
  });

  it("ignores a second section for the same person", () => {
    const out = validReply(check.request);
    out.members.push({ ...m1(out), line: { en: "{m1}: something else entirely." } });
    expect(run(out)?.people.kavita.line?.en).toBe(m1(validReply(check.request)).line.en);
  });
});

describe("plan validator: swaps", () => {
  const altId = "metro_for_scooter";
  const withSwap = (swap: PlanOutput["members"][number]["swap"]) => {
    const out = validReply(check.request);
    m1(out).swap = swap;
    return run(out)?.people.kavita.swap;
  };

  it("stores a passing swap why under the alternative's own fact", () => {
    const swap = withSwap({ altId, doThis: { en: "Take the metro today, not the scooter." }, why: GOOD_WHY });
    expect(swap).toEqual({
      altId,
      doThis: { en: "Take the metro today, not the scooter." },
      why: GOOD_WHY,
      factId: alternativeById(altId)?.factId,
    });
  });

  it("keeps a swap without a why, with no fact", () => {
    expect(withSwap({ altId, doThis: { en: "Take the metro today, not the scooter." } })).toEqual({
      altId,
      doThis: { en: "Take the metro today, not the scooter." },
    });
  });

  it("drops a swap whose doThis fails, and one the person is not offered", () => {
    expect(withSwap({ altId, doThis: { en: "Kavita, take the metro." }, why: GOOD_WHY })).toBeNull();
    expect(withSwap({ altId: "not_offered", doThis: { en: "Take the metro." } })).toBeNull();
  });
});

describe("plan validator: request edges", () => {
  it("allows only the times the request names, without windows when there are none", () => {
    const air = { ...check.request.input.air, bestWindow: null, worstWindow: null };
    const request = { ...check.request, input: { ...check.request.input, air } };
    const hhmm = (t: { hour: number; minute: number }) => `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
    const named = request.input.members.flatMap((m) =>
      m.activities.flatMap((a) => [a.usual, ...(a.rule.bestTime ? [a.rule.bestTime] : [])]),
    );
    expect(allowedTimes(request).map(hhmm)).toEqual(named);
    expect(allowedTimes(check.request).map(hhmm)).toEqual(["15:00", "17:00", "07:00", "10:00", ...named]);
  });

  it("checks a row line with no known headline activity as plain text", () => {
    const tokens = { ...check.request.tokens, headline: {} };
    const headless = { ...check, request: { ...check.request, tokens } };
    const plan = run(validReply(check.request), headless);
    expect(plan?.people.kavita.line).not.toBeNull();
  });
});
