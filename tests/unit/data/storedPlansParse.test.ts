import { describe, expect, it, vi } from "vitest";
import { storedDemoPlanFor, storedDemoPlans } from "@/data/demo/storedPlans";

/** The stored-plan file once recorded (here a stand-in, so the parsing branches are tested before the key exists). */
vi.mock("@/data/demo/storedPlans.json", () => ({
  default: {
    "smog-morning": { recordedOn: "2026-11-24", model: "gemini-test", promptVersion: 2, plan: { source: "gemini" }, sections: {} },
  },
}));

describe("stored demo plan file", () => {
  it("reads a recorded scenario and lists it", () => {
    expect(storedDemoPlanFor("smog-morning")?.plan.source).toBe("gemini");
    expect(storedDemoPlanFor("severe-day")).toBeNull();
    expect(storedDemoPlans().map(([id, entry]) => [id, entry.model])).toEqual([["smog-morning", "gemini-test"]]);
  });
});
