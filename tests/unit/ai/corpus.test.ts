import { describe, expect, it } from "vitest";
import { checkPlanItem, checkText, LENGTH_CAPS } from "@/ai/shared/validate";
import { ENGLISH_BAD, ENGLISH_GOOD } from "../../fixtures/corpus/english";
import { HINDI_BAD, HINDI_GOOD, HINGLISH_BAD } from "../../fixtures/corpus/hindi";
import { ALLOWED_TIMES, NAMES, RULES, type CorpusCase } from "../../fixtures/corpus/types";

const GOOD = [...ENGLISH_GOOD, ...HINDI_GOOD];
const BAD = [...ENGLISH_BAD, ...HINDI_BAD, ...HINGLISH_BAD];

function run(c: CorpusCase) {
  const rules = {
    lang: c.lang,
    maxLength: LENGTH_CAPS.doThis[c.lang],
    allowedTimes: ALLOWED_TIMES,
    names: NAMES,
    forDependent: c.forDependent ?? false,
  };
  return c.rule ? checkPlanItem(c.text, RULES[c.rule], rules) : checkText(c.text, rules);
}

describe("validator corpus (spec 7.1, 11.4): about 100 sentences in EN, HI and Hinglish", () => {
  it("has about 50 good and 50 bad sentences", () => {
    expect(GOOD.length).toBeGreaterThanOrEqual(45);
    expect(BAD.length).toBeGreaterThanOrEqual(50);
    expect(HINGLISH_BAD).toHaveLength(10);
  });

  it.each(GOOD.map((c) => [c.text, c] as const))("passes: %s", (_, c) => expect(run(c)).toEqual([]));

  it.each(BAD.map((c) => [c.text, c] as const))("rejects: %s", (_, c) => {
    const reasons = run(c);
    expect(reasons).toEqual(expect.arrayContaining([...c.expect]));
  });
});
