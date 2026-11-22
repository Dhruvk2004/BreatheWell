import { describe, expect, it } from "vitest";
import { devanagariShare } from "@/ai/shared/language";
import en from "@/i18n/en.json";
import hi from "@/i18n/hi.json";
import { activityKey, modeKey, noteKey, suggestionKey } from "@/i18n/labels";
import { isLang, langOf, t, translator } from "@/i18n/t";
import { ACTIVITY_TYPES } from "@/domain/rules/activities";
import { MODES } from "@/domain/rules/modes";
import { PLAN_NOTES, SUGGESTIONS } from "@/domain/rules/plan";

// Pollutant formulas, the AQI abbreviation and product names read the same in both languages.
const TECHNICAL = [
  "air.strip.aqi",
  "air.pollutant.pm25",
  "air.pollutant.pm10",
  "air.pollutant.no2",
  "air.pollutant.o3",
  "air.pollutant.co",
  "air.pollutant.so2",
  "privacy.gemini.title",
];
// Words that are the same in both files on purpose: brand, the "Aa" glyph, formulas.
const SAME_IN_BOTH = new Set(["app.name", "shell.textSize.button", ...TECHNICAL]);
// Brand-heavy Hindi strings (the brand names BreatheWell and Breezy stay in Latin script).
const LATIN_IN_HINDI = new Set([
  "app.name",
  "shell.textSize.button",
  "shell.lang.switch",
  "shell.home",
  "shell.footer.credit",
  "community.t.footer",
  "breezyDemo.title",
  "privacy.keep.chats",
  "plan.madeBy",
  "plan.storedDemo",
  ...TECHNICAL,
]);

describe("i18n (spec F17)", () => {
  it("has exactly the same keys in en.json and hi.json", () => {
    expect(Object.keys(hi).sort()).toEqual(Object.keys(en).sort());
  });

  it("writes Hindi in Devanagari and English in Latin", () => {
    // Placeholders are filled by code ("{aqi}"), so they do not count as letters of either script.
    const words = (value: string) => value.replace(/\{\w+\}/g, "");
    const hasWords = (value: string) => /\p{L}/u.test(words(value));
    for (const [key, value] of Object.entries(hi))
      if (!LATIN_IN_HINDI.has(key) && hasWords(value)) expect(devanagariShare(words(value)), key).toBeGreaterThanOrEqual(0.5);
    for (const [key, value] of Object.entries(en))
      if (key !== "shell.lang.switch" && !TECHNICAL.includes(key) && hasWords(value)) expect(devanagariShare(words(value)), key).toBe(0);
    for (const key of Object.keys(en))
      if (!SAME_IN_BOTH.has(key)) expect(hi[key as keyof typeof hi], key).not.toBe(en[key as keyof typeof en]);
  });

  it("uses no gendered pronouns in English copy", () => {
    for (const value of Object.values(en)) expect(value).not.toMatch(/\b(he|she|his|her|him|hers)\b/i);
  });

  it("fills placeholders and leaves unknown ones visible", () => {
    expect(t("en", "shell.textSize.label", { size: "Large" })).toBe("Text size: Large");
    expect(t("hi", "shell.textSize.label")).toBe("अक्षरों का आकार: {size}");
    expect(translator("hi")("verdict.avoid")).toBe("न जाएँ");
    expect([isLang("en"), isLang("hi"), isLang("fr"), isLang(undefined)]).toEqual([true, true, false, false]);
    expect([langOf("hi"), langOf("fr"), langOf(["hi"])]).toEqual(["hi", "en", "en"]);
  });

  it("has EN and HI words for every plan note, suggestion, mode and activity (review slice 1, finding 6)", () => {
    const keys = [...PLAN_NOTES.map(noteKey), ...SUGGESTIONS.map(suggestionKey), ...MODES.map(modeKey), ...ACTIVITY_TYPES.map(activityKey)];
    for (const key of keys) {
      expect(en, key).toHaveProperty([key]);
      expect(hi, key).toHaveProperty([key]);
    }
    expect(t("en", noteKey("schools_may_close"))).toBe("On Severe days schools and offices may close; check official notices.");
    expect(t("hi", modeKey("auto_bus"))).toBe("ऑटो या बस");
  });
});
