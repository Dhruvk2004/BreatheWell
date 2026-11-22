import { describe, expect, it } from "vitest";
import { MODE_WORDS } from "@/ai/shared/contradiction";
import { devanagariShare, inLanguage } from "@/ai/shared/language";
import { asciiDigits, normaliseNumbers, numberWordsToDigits, wordsValue } from "@/ai/shared/normalise";
import { numberProblems } from "@/ai/shared/numbers";
import { nfc, nfcRegExp, sentences } from "@/ai/shared/text";
import { findTimes, isAllowedTime, mentionsHour, withoutTimes } from "@/ai/shared/times";
import { isValidText, unknownIds } from "@/ai/shared/validate";
import { MODES } from "@/domain/rules/modes";

describe("number normalisation", () => {
  it("turns Devanagari digits and number words into digits", () => {
    expect(asciiDigits("हवा ३६८ है")).toBe("हवा 368 है");
    expect(numberWordsToDigits("about three hundred and forty today")).toBe("about 340 today");
    expect(numberWordsToDigits("Twenty-five people")).toBe("25 people");
    expect(numberWordsToDigits("तीन सौ से ज़्यादा")).toBe("300 से ज़्यादा");
    expect(numberWordsToDigits("two thousand five hundred")).toBe("2500");
    expect(normaliseNumbers("someone ate a good diet")).toBe("someone ate a good diet");
    expect(wordsValue(["thousand"])).toBe(1000);
    expect(wordsValue(["hundred"])).toBe(100);
  });
});

describe("clock times in text", () => {
  it("reads English, Hindi and 24-hour times and ranges", () => {
    expect(findTimes("Go at 3 pm").map((t) => t.hours)).toEqual([[[15]]]);
    expect(findTimes("6:30 a.m. walk")[0]).toMatchObject({ hours: [[6]], minutes: [30] });
    expect(findTimes("best 2–4 pm")[0].hours).toEqual([[14], [16]]);
    expect(findTimes("12 am")[0].hours).toEqual([[0]]);
    expect(findTimes("दोपहर 3 बजे")[0].hours).toEqual([[15]]);
    expect(findTimes("रात 9 बजे")[0].hours).toEqual([[21]]);
    expect(findTimes("रात 12 बजे")[0].hours).toEqual([[0]]);
    expect(findTimes("सुबह 12 बजे")[0].hours).toEqual([[0]]);
    expect(findTimes("दोपहर 12 बजे")[0].hours).toEqual([[12]]);
    expect(findTimes("शाम 12 बजे")[0].hours).toEqual([[12]]);
    expect(findTimes("रात 2 बजे")[0].hours).toEqual([[2]]);
    expect(findTimes("3 बजे")[0].hours).toEqual([[3, 15]]);
    expect(findTimes("12 बजे")[0].hours).toEqual([[12, 0]]);
    expect(findTimes("2–4 बजे")[0].hours).toEqual([
      [2, 14],
      [4, 16],
    ]);
    expect(findTimes("at 15:00")[0]).toMatchObject({ hours: [[15]], minutes: [0] });
    expect(findTimes("for 15 minutes")).toEqual([]);
  });

  it("checks times against the allowed list", () => {
    const allowed = [{ hour: 15, minute: 0 }];
    expect(isAllowedTime(findTimes("3 pm")[0], allowed)).toBe(true);
    expect(isAllowedTime(findTimes("3:30 pm")[0], allowed)).toBe(false);
    expect(mentionsHour("skip the 6:30 walk", 6, 30)).toBe(true);
    expect(mentionsHour("skip the 6:30 walk", 6)).toBe(false);
    expect(withoutTimes("walk at 3 pm today")).toBe("walk at   today");
  });
});

describe("number leaks", () => {
  const allowed = [{ hour: 15, minute: 0 }];
  it.each([
    ["Wear an N95", []],
    ["Call 112", []],
    ["Walk for 30 minutes at 3 pm", []],
    ["PM10 is coarse dust", []],
    ["PM2.5 = 200", ["number_leak"]],
    ["about 2.5 kg", ["number_leak"]],
    ["{m1} and {d2} go together", []],
    ["7 families", []],
    ["11 families", ["number_leak"]],
    ["200 µg", ["air_unit", "number_leak"]],
  ] as const)("%s → %j", (text, expected) => expect(numberProblems(text, allowed)).toEqual(expected));
});

describe("language and text helpers", () => {
  it("measures Devanagari and allows neutral tokens", () => {
    expect(devanagariShare("N95 मास्क")).toBe(1);
    expect(devanagariShare("")).toBe(1);
    expect(inLanguage("N95", "en")).toBe(true);
    expect(inLanguage("Walk in the hall", "en")).toBe(true);
    expect(inLanguage("Walk in the hall", "hi")).toBe(false);
    expect(inLanguage("हॉल में धीरे सैर करें, with care", "hi")).toBe(true);
  });

  it("normalises nukta letters and splits sentences on the danda", () => {
    expect(nfc("ड़")).toBe("ड़");
    expect(nfcRegExp("ड़").test("ड़")).toBe(true);
    expect(sentences("आज अंदर रहें। कल जाएँ! Ok.")).toEqual(["आज अंदर रहें", "कल जाएँ", "Ok"]);
  });

  it("has words for every mode and finds unknown ids", () => {
    for (const mode of MODES) expect(MODE_WORDS[mode].length).toBeGreaterThan(0);
    expect(unknownIds(["m1", "m9", "morning_inversion"], ["m1", "morning_inversion"])).toEqual(["m9"]);
    const rules = { lang: "en" as const, maxLength: 50, allowedTimes: [], names: [], forDependent: false };
    expect(isValidText("Keep windows shut.", rules)).toBe(true);
    expect(isValidText("AQI 400", rules)).toBe(false);
  });
});
