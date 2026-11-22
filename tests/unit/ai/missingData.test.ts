import { afterEach, describe, expect, it, vi } from "vitest";
import { evalCase, evalCases } from "@/ai/eval/planEval";
import { EVAL_FAMILIES } from "@/ai/eval/families";
import { planFamilyToday, UNKNOWN_HOME } from "@/server/app/familyPlan";
import { demoBreezyContext, demoChips } from "@/server/demo/demoBreezy";
import { recordedDemo } from "@/server/demo/demoPage";
import { demoPlanCheck } from "@/server/demo/demoPlan";
import { planCheckFor } from "@/server/plan/context";
import { loadFamily } from "@/server/repos/family";
import { testApp } from "../../helpers/appDeps";
import type * as Pollutants from "@/domain/air/pollutants";
import type * as Facts from "@/domain/impact/facts";
import type * as Families from "@/ai/eval/families";
import type * as BreezyContextModule from "@/server/breezy/context";
import { sharmaFamily } from "../../helpers/family";

/**
 * Gaps in the data the prompt is built from: no morning weather, a family with nobody planned, a
 * missing library fact and a family without a home setup. Each must degrade, never throw or leak.
 */
const gaps = vi.hoisted(() => ({ noWeather: false, noFacts: false, contexts: [] as unknown[] }));

vi.mock("@/domain/air/pollutants", async (orig) => {
  const real = await orig<typeof Pollutants>();
  return {
    ...real,
    morningWeather: (...args: Parameters<typeof real.morningWeather>) => (gaps.noWeather ? null : real.morningWeather(...args)),
  };
});
vi.mock("@/domain/impact/facts", async (orig) => {
  const real = await orig<typeof Facts>();
  return { ...real, factById: (id: string) => (gaps.noFacts ? undefined : real.factById(id)) };
});
vi.mock("@/ai/eval/families", async (orig) => {
  const real = await orig<typeof Families>();
  const empty = { id: "nobody", scenario: "smog-morning" as const, people: [], home: real.EVAL_FAMILIES[0].home };
  return { ...real, EVAL_FAMILIES: [...real.EVAL_FAMILIES, empty] };
});
vi.mock("@/server/breezy/context", async (orig) => {
  const real = await orig<typeof BreezyContextModule>();
  return {
    ...real,
    assembleContext: (input: Parameters<typeof real.assembleContext>[0]) => {
      gaps.contexts.push(input);
      return real.assembleContext(input);
    },
  };
});

afterEach(() => Object.assign(gaps, { noWeather: false, noFacts: false, contexts: [] }));

describe("plan input without weather or people", () => {
  it("an eval family with nobody planned has no case and is left out of the run", () => {
    expect(EVAL_FAMILIES).toHaveLength(11);
    expect(evalCase(EVAL_FAMILIES[10])).toBeNull();
    expect(evalCases().map((c) => c.id)).not.toContain("nobody");
  });

  it("sends a null weather reason when the morning hour is missing", () => {
    gaps.noWeather = true;
    expect(evalCase(EVAL_FAMILIES[0])?.check.request.input.air.weatherWhy).toBeNull();
    const demo = recordedDemo("smog-morning", 6, "neha");
    expect(demoPlanCheck(demo.day, demo.weather)?.request.input.air.weatherWhy).toBeNull();
  });

  it("a real family without a home setup is planned with the unknown home and no weather", async () => {
    gaps.noWeather = true;
    const app = testApp();
    const { fid } = await sharmaFamily(app);
    const bundle = await loadFamily(app.db, fid);
    if (!bundle) throw new Error("no family");
    const bare = { ...bundle, homeSetup: null };
    const check = planCheckFor(bare, await planFamilyToday(bare, "neha", app.deps.air));
    expect(check?.request.input.air.weatherWhy).toBeNull();
    expect(check?.request.input.home).toEqual(UNKNOWN_HOME);
  });
});

describe("demo Breezy with gaps", () => {
  it("the mask chip says nothing rather than crash when the fact is missing", () => {
    gaps.noFacts = true;
    const chips = demoChips({ scenario: "live", time: 6, view: "neha" }, recordedDemo("smog-morning", 6, "neha"), "en");
    expect(chips.find((c) => c.id === "mask")).toMatchObject({ text: "", source: "template" });
  });

  it("names nobody and marks nobody a dependent for an id outside the demo family", () => {
    expect(demoBreezyContext(recordedDemo("smog-morning", 6, "neha"), "en")).not.toBeNull();
    const input = gaps.contexts[0] as { namesOf(id: string): string[]; isDependent(id: string): boolean };
    expect(input.namesOf("stranger")).toEqual([]);
    expect(input.isDependent("stranger")).toBe(false);
    expect(input.namesOf("riya")).toEqual(expect.arrayContaining(["Riya"]));
    expect(input.isDependent("riya")).toBe(true);
  });
});
