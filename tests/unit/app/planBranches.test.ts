import { describe, expect, it } from "vitest";
import type { ValidPlan } from "@/ai/plan/validate";
import { DEMO_FAMILY } from "@/data/demo/family";
import { storedDemoPlanFor, storedDemoPlans } from "@/data/demo/storedPlans";
import { bestBand, swapOptions } from "@/domain/family/swaps";
import { recordedDemo } from "@/server/demo/demoPage";
import { sectionsOf } from "@/server/plan/sections";
import { familyShareText } from "@/server/plan/share";
import { releaseClaim } from "@/server/repos/plans";
import { MemoryDb } from "../../helpers/memoryDb";
import { HOME_SETUP } from "../../helpers/family";

/** Branches of the share-text and swap-option helpers: missing pieces fall back, never throw. */
const demo = recordedDemo("smog-morning", 6, "neha");
const { day } = demo;
const people = day.rows.map((r) => ({ id: r.person.id, name: r.person.id, mainMode: r.person.travel.main }));

describe("share text branches", () => {
  it("leaves out people with no headline or not in the family, and the best-time line without a window", () => {
    const [first, ...rest] = day.rows;
    const noHeadline = { ...day, rows: [{ ...first, headline: null }, ...rest] };
    const text = familyShareText(noHeadline, people.slice(1, 2), "Delhi", "en") ?? "";
    expect(text.split("\n\n")).toHaveLength(2);
    expect(text).not.toContain(`${first.person.id}:`);
    const noBest = familyShareText({ ...day, summary: { ...day.summary, best: null } }, people, "Delhi", "hi") ?? "";
    expect(noBest.startsWith("आज Delhi में हवा")).toBe(true);
    expect(noBest).not.toContain("सबसे अच्छा समय");
    expect(noBest).not.toContain("Best time outside");
    expect(familyShareText({ ...day, summary: { ...day.summary, now: null } }, people, "Delhi", "en")).toBeNull();
  });
});

describe("swap options branches", () => {
  it("uses the band now without a best window, and offers nothing without any data", () => {
    const person = day.rows[0].person;
    expect(bestBand({ ...day.summary, best: null })).toBe(day.summary.now?.band);
    expect(bestBand({ ...day.summary, best: null, now: null })).toBeNull();
    expect(swapOptions(person, { ...day.summary, best: null, now: null }, HOME_SETUP, false)).toEqual([]);
  });
});

describe("plan sections branches", () => {
  it("skips people without words, keeps only items that passed, and stores no line without one", () => {
    const [row] = day.rows;
    const words: ValidPlan = {
      people: { [row.person.id]: { line: null, items: {}, swap: null } },
      home: [],
      together: null,
      passed: 1,
      failed: 0,
      reasons: [],
    };
    const sections = sectionsOf(words, day.rows);
    expect(Object.keys(sections)).toEqual([row.person.id]);
    expect(sections[row.person.id]).toEqual({ line: null, items: {}, swap: null });
  });
});

describe("stored demo plans and claims", () => {
  it("answers null for an unknown scenario and while nothing is recorded", () => {
    expect(storedDemoPlanFor("made-up")).toBeNull();
    expect(storedDemoPlanFor("smog-morning")).toEqual(storedDemoPlans().find(([id]) => id === "smog-morning")?.[1] ?? null);
    expect(DEMO_FAMILY.length).toBeGreaterThan(0);
  });

  it("releaseClaim leaves another request's lock alone", async () => {
    const db = new MemoryDb();
    db.docs.set("families/f1/plans/2024-11-18", { generatingSince: "2024-11-18T00:40:00.000Z", generations: 2 });
    await releaseClaim(db, "f1", "2024-11-18", "2024-11-18T00:39:00.000Z");
    expect(db.docs.get("families/f1/plans/2024-11-18")).toMatchObject({ generations: 2 });
    await releaseClaim(db, "f1", "2024-11-18", "2024-11-18T00:40:00.000Z");
    expect(db.docs.get("families/f1/plans/2024-11-18")).toMatchObject({ generatingSince: null, generations: 1 });
    await releaseClaim(db, "f1", "2024-11-19", "x");
    expect(db.docs.has("families/f1/plans/2024-11-19")).toBe(false);
  });
});
