import { describe, expect, it } from "vitest";
import { rejectsTime } from "@/ai/breezy/timeCheck";
import { validateBreezy } from "@/ai/breezy/validate";
import { findTimes } from "@/ai/shared/times";
import { asViewer, card, demoContext, reply } from "../../helpers/breezy";

/**
 * Stage 7 AI-1 and AI-6 🔒: the rules judge every time in Breezy's text, however it is written.
 * Demo Smog morning, viewer Dadaji (m3): his morning walk is Avoid.
 */
const en = asViewer(demoContext().check, "m3");
const hi = asViewer(demoContext("smog-morning", "hi").check, "m3");

describe("times in words, Devanagari digits and spoken forms (AI-1)", () => {
  it("still rejects the digit forms", () => {
    expect(validateBreezy(reply("You can go for your walk at 8 am today."), en)).toBeNull();
    expect(validateBreezy(reply("आप सुबह 8 बजे सैर पर जा सकते हैं।", [], "hi"), hi)).toBeNull();
  });

  it.each([
    "You can go for your walk at eight am today.",
    "You can go for your walk at 8 in the morning.",
    "You can go for your walk at 8 o'clock this morning.",
    "You can go for your walk at eight o'clock.",
    "Subah 8 baje park mein walk kar lo.",
    "Go for your walk at 8 today.",
  ])("rejects the English reply %s", (text) => {
    expect(validateBreezy(reply(text), en)).toBeNull();
  });

  it.each(["आप सुबह ८ बजे सैर पर जा सकते हैं।", "आप सुबह आठ बजे सैर पर जा सकते हैं।"])("rejects the Hindi reply %s", (text) => {
    expect(validateBreezy(reply(text, [], "hi"), hi)).toBeNull();
  });

  it("drops a checklist card for Riya (d2) to play outside at eight am / ८ बजे", () => {
    const play = card({
      forMemberId: "d2",
      action: "add_checklist",
      time: null,
      activityType: null,
      factId: null,
      title: "Play outside",
      why: "",
      item: { en: "Play outside at eight am", hi: "सुबह ८ बजे बाहर खेलें" },
    });
    expect(validateBreezy(reply("Here are ideas for {d2}.", [play]), demoContext().check)?.cards).toEqual([]);
  });

  it("reads the spoken and Hinglish forms with their day part", () => {
    expect(findTimes("8 in the morning")[0]?.hours).toEqual([[8]]);
    expect(findTimes("7 this evening")[0]?.hours).toEqual([[19]]);
    expect(findTimes("9 o'clock tonight")[0]?.hours).toEqual([[21]]);
    expect(findTimes("10 o'clock")[0]?.hours).toEqual([[10, 22]]);
    expect(findTimes("shaam 5 baje")[0]?.hours).toEqual([[17]]);
    expect(findTimes("12 baje")[0]?.hours).toEqual([[12, 0]]);
  });

  it("keeps a cancelled number-word time and a duration from counting as a recommended hour", () => {
    const scope = { people: ["m3"], defaults: ["m3"], date: "today" as const, allowed: () => false };
    expect(rejectsTime("Skip the eight am walk today.", scope)).toBe(false);
    expect(rejectsTime("Walk indoors for 10 minutes.", scope)).toBe(false);
    expect(rejectsTime("Walk at 10 minutes past the hour indoors.", scope)).toBe(false);
  });
});

describe("outing words the rules judge (AI-6)", () => {
  it.each(["Do yoga on the terrace at 8 am.", "Exercise in the open at 8 am.", "Go running at 8 am."])(
    "rejects %s at an Avoid hour",
    (text) => {
      expect(validateBreezy(reply(text), en)).toBeNull();
    },
  );

  it.each(["आप सुबह 8 बजे दौड़ लगाएँ।", "आप सुबह 8 बजे योग छत पर करें।", "सुबह 8 बजे खुले में व्यायाम करें।"])(
    "rejects %s at an Avoid hour",
    (text) => {
      expect(validateBreezy(reply(text, [], "hi"), hi)).toBeNull();
    },
  );
});
