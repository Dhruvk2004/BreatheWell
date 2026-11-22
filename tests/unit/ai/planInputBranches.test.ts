import { describe, expect, it } from "vitest";
import { nameWords, planCheck } from "@/ai/plan/check";
import { hourBand, planRequest, type PlanSource } from "@/ai/plan/input";
import type { FamilyPerson } from "@/domain/family/people";
import fc from "fast-check";
import { checkOf, familyOf, namesOf, sourceOf } from "../../helpers/planSource";

/** The plan prompt input (spec 7.2): what is left out when the day has gaps, and the token map. */
const withSummary = (src: PlanSource, over: Partial<PlanSource["day"]["summary"]>): PlanSource => ({
  ...src,
  day: { ...src.day, summary: { ...src.day.summary, ...over } },
});

describe("planRequest edges", () => {
  it("sends null windows and a null 24-hour band when the forecast is too short", () => {
    const request = planRequest(withSummary(sourceOf(), { best: null, worst: null, avg24: null }));
    expect(request?.input.air).toMatchObject({ bestWindow: null, worstWindow: null, avg24Band: null });
  });

  it("returns null when there is no 'now' or nobody was planned", () => {
    const src = sourceOf();
    expect(planRequest(withSummary(src, { now: null }))).toBeNull();
    expect(planRequest({ ...src, day: { ...src.day, rows: [] } })).toBeNull();
  });

  it("skips a stored person with no row and a row with no items, without spending a token", () => {
    const src = sourceOf();
    const ghost = { ...src.people[0], id: "ghost" } as FamilyPerson;
    const rows = src.day.rows.map((r) => (r.person.id === "ishaan" ? { ...r, items: [] } : r));
    const request = planRequest({ ...src, people: [ghost, ...src.people], day: { ...src.day, rows } });
    expect(request?.tokens.people).toEqual({ m1: "kavita", d1: "meera" });
    expect(JSON.stringify(request?.input)).not.toMatch(/ghost|ishaan/);
  });

  it("keeps an unknown together action in the allowlist but adds no fact for it", () => {
    const src = sourceOf();
    const odd = { ...src, day: { ...src.day, together: "made_up_action" } } as unknown as PlanSource;
    const input = planRequest(odd)?.input;
    expect(input?.allowedAlternatives).toContain("made_up_action");
    expect(input?.allowedFacts).not.toContain("");
  });

  it("gives a person with no known name an empty display name, never an id", () => {
    const { forbidden } = namesOf();
    const check = planCheck(sourceOf(), { kavita: "Kavita" }, forbidden);
    expect(check?.nameOf).toEqual({ m1: "Kavita", d1: "", d2: "" });
  });

  it("returns no check when the rules planned nobody", () => {
    const src = sourceOf();
    expect(planCheck({ ...src, day: { ...src.day, rows: [] } }, {}, [])).toBeNull();
  });
});

describe("hourBand and nameWords (properties)", () => {
  it("every hour maps to the band of its range, and bands never go backwards through the day", () => {
    const order = ["early_morning", "morning", "afternoon", "evening", "night"];
    fc.assert(fc.property(fc.integer({ min: 0, max: 22 }), (h) => order.indexOf(hourBand(h)) <= order.indexOf(hourBand(h + 1))));
    expect([0, 7, 12, 17, 21].map(hourBand)).toEqual(order);
  });

  it("keeps every full name and each 3+ letter word, drops 'family' and short words", () => {
    fc.assert(
      fc.property(fc.array(fc.stringMatching(/^[A-Za-z]{1,8}( [A-Za-z]{1,8})?$/u), { maxLength: 5 }), (names) => {
        const words = nameWords(names);
        for (const n of names) expect(words).toContain(n);
        for (const w of words) expect(names.includes(w) || ([...w].length >= 3 && w.toLowerCase() !== "family")).toBe(true);
      }),
    );
    expect(nameWords(["Sharma Family", "Al Bo"])).toEqual(["Sharma Family", "Al Bo", "Sharma"]);
  });

  it("no eval family name or name word reaches the prompt, even with Devanagari names", () => {
    for (const id of ["two-dependents", "hindi-grandparent", "ten-people"]) {
      const payload = JSON.stringify(checkOf(sourceOf(id), id).request.input).toLowerCase();
      for (const word of namesOf(id).forbidden) expect(payload).not.toContain(word.toLowerCase());
      for (const p of familyOf(id).people) expect(payload).not.toContain(p.id.toLowerCase());
    }
  });
});
