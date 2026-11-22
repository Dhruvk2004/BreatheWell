import { describe, expect, it } from "vitest";
import { isEmergency } from "@/domain/safety/emergency";
import { EMERGENCY_NEGATIVE as NEGATIVE, EMERGENCY_POSITIVE as POSITIVE } from "../../fixtures/corpus/emergency";

describe("isEmergency corpus", () => {
  it.each(POSITIVE)("%s is an emergency", (text) => expect(isEmergency(text)).toBe(true));
  it.each(NEGATIVE)("%s is not", (text) => expect(isEmergency(text)).toBe(false));
  it("has at least 30 positive and 15 negative phrases", () => {
    expect(POSITIVE.length).toBeGreaterThanOrEqual(30);
    expect(NEGATIVE.length).toBeGreaterThanOrEqual(15);
  });
});
