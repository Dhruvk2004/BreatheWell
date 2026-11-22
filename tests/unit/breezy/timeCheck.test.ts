import { describe, expect, it } from "vitest";
import { rejectsTime, type HourAllowed } from "@/ai/breezy/timeCheck";
import { validateBreezy } from "@/ai/breezy/validate";
import { asViewer, card, demoContext, reply } from "../../helpers/breezy";

/**
 * The rules on every time in Breezy's free text (review H5, design G), on the demo Smog morning at
 * 6 am: Dadaji (m3) and Riya (d2) may not go out in the morning; 3 pm is allowed.
 */
const { check } = demoContext();

describe("times in the reply and in cards", () => {
  it.each(["{m3} can go for a walk at 8 am today.", "{d2} can play outside at 8 am.", "{m3} सुबह 8 बजे सैर पर जा सकते हैं।"])(
    "rejects the reply %s",
    (text) => {
      const lang = /[ऀ-ॿ]/u.test(text) ? "hi" : "en";
      const viewerCheck = lang === "hi" ? demoContext("smog-morning", "hi").check : check;
      expect(validateBreezy(reply(text, [], lang), viewerCheck)).toBeNull();
    },
  );

  it("rejects 'your walk at 8 am' for the viewer Dadaji, and keeps 3 pm", () => {
    const dadaji = asViewer(check, "m3");
    expect(validateBreezy(reply("You can go for your walk at 8 am today."), dadaji)).toBeNull();
    expect(validateBreezy(reply("You can go for your walk at 3 pm today."), dadaji)).not.toBeNull();
  });

  it("drops a checklist card for Riya that says to play outside at 8 am, in either language", () => {
    const play = card({
      forMemberId: "d2",
      action: "add_checklist",
      time: null,
      activityType: null,
      factId: null,
      title: "Play outside at 8 am",
      why: "",
      item: { en: "Play outside at 8 am", hi: "सुबह 8 बजे बाहर खेलें" },
    });
    const hindiOnly = { ...play, title: "Water bottle", item: { en: "Carry a water bottle", hi: "सुबह 8 बजे बाहर खेलें" } };
    const valid = validateBreezy(reply("Here are ideas for {d2}.", [play, hindiOnly]), check);
    expect(valid?.cards).toEqual([]);
  });

  it("keeps skip phrases, times without an outing, and outings at an allowed hour", () => {
    for (const text of [
      "Skip the 8 am walk; {m3} can go at 3 pm instead.",
      "The air is worst at 8 am, so keep windows shut.",
      "{m3} can visit the temple at 3 pm.",
    ])
      expect(validateBreezy(reply(text), check)).not.toBeNull();
  });
});

describe("rejectsTime", () => {
  const only3pm: HourAllowed = (_, __, ___, hour) => hour === 15;
  const scope = { people: ["m1", "m2"], defaults: [], date: "today" as const, allowed: only3pm };

  it("needs one allowed person when nobody is named, and every named person otherwise", () => {
    const someone: HourAllowed = (p, _, __, hour) => p === "m1" && hour === 8;
    expect(rejectsTime("Go for a walk at 8 am.", { ...scope, allowed: someone })).toBe(false);
    expect(rejectsTime("{m1} and {m2} can walk at 8 am.", { ...scope, allowed: someone })).toBe(true);
  });

  it("judges tomorrow's times on tomorrow, and ignores hours outside the day", () => {
    const tomorrow: HourAllowed = (_, __, date) => date === "tomorrow";
    expect(rejectsTime("Walk at 8 am tomorrow.", { ...scope, allowed: tomorrow })).toBe(false);
    expect(rejectsTime("Walk at 8 am.", { ...scope, allowed: tomorrow })).toBe(true);
    expect(rejectsTime("Walk at 11 pm.", scope)).toBe(false);
  });

  it("takes the sentence's outing for its only timed clause", () => {
    expect(rejectsTime("At 8 am, go for a walk.", scope)).toBe(true);
    expect(rejectsTime("At 8 am, go for a walk; at 3 pm too.", scope)).toBe(false);
    expect(rejectsTime("Shut the windows at 8 am.", scope)).toBe(false);
  });
});
