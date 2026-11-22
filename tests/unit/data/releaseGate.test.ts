import { describe, expect, it } from "vitest";
import { storedDemoPlanFor, storedDemoPlans } from "@/data/demo/storedPlans";

/**
 * Release gate (slice 2 blocker H1, review slice 4 H3): the judges' demo must show real Gemini
 * text at 6 am. It runs only with `npm run test:release` (RELEASE_CHECK=1) and fails while
 * `src/data/demo/storedPlans.json` has no smog-morning plan; run `npm run demo:record-plans` with
 * a key first. Once recorded, the owner adds `npm run test:release` to CI.
 */
describe.runIf(process.env.RELEASE_CHECK === "1")("release gate: stored demo plans", () => {
  it("smog-morning has a stored Gemini plan with words for every planned person", () => {
    const stored = storedDemoPlanFor("smog-morning");
    expect(stored, "storedPlans.json has no smog-morning plan: run npm run demo:record-plans").not.toBeNull();
    expect(stored?.plan.source).toBe("gemini");
    expect(Object.keys(stored?.sections ?? {}).length).toBeGreaterThan(0);
    expect(storedDemoPlans().every(([, entry]) => entry.model.length > 0 && entry.recordedOn.length > 0)).toBe(true);
  });
});
