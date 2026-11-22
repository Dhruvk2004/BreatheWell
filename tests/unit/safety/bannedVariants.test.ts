import { describe, expect, it } from "vitest";
import { validateCommunity } from "@/ai/community/validate";
import type { CommunityOutput, CommunityPromptInput } from "@/ai/community/schema";
import { banProblems } from "@/ai/shared/banned";
import { kidCardProblems } from "@/domain/libraries/kid/checks";

/** Stage 7 AI-4, AI-5 and PT-3 🔒: bans by concept and stem, not only by fixed phrase. */
const WORDS: CommunityOutput = {
  en: {
    title: "Smog morning in our area",
    body: "Good morning, everyone. Keep morning walks indoors today. Children can play after 2 pm.",
    together: "no leaf or garbage burning in our society.",
  },
  hi: {
    title: "आज सुबह धुंध है",
    body: "सुप्रभात। आज सुबह की सैर घर के अंदर करें। बच्चे दोपहर 2 बजे के बाद खेलें।",
    together: "सोसाइटी में पत्ते या कचरा न जलाएँ।",
  },
};
const TIMES = [
  { hour: 14, minute: 0 },
  { hour: 16, minute: 0 },
];
const INPUT: CommunityPromptInput = {
  place: "Delhi",
  audience: "housing_society",
  band: "very_poor",
  bestWindow: "14:00-16:00",
  worstWindow: "06:00-08:00",
  windowDay: "today",
  together: "no_leaf_burning",
};
const withBody = (lang: "en" | "hi", text: string): string => JSON.stringify({ ...WORDS, [lang]: { ...WORDS[lang], body: text } });
const bans = (text: string) => banProblems(text, { names: [], forDependent: false });

describe("cigarette comparisons in every form (AI-4)", () => {
  it("keeps the clean community message", () => {
    expect(validateCommunity(JSON.stringify(WORDS), TIMES, INPUT)).not.toBeNull();
  });

  it.each([
    ["en", "Good morning. Breathing this air is like smoking ten a day. Stay indoors."],
    ["hi", "सुप्रभात। यह हवा दस सिगरेटों जितनी है। घर के अंदर रहें।"],
  ] as const)("rejects a community %s body with a cigarette comparison", (lang, text) => {
    expect(validateCommunity(withBody(lang, text), TIMES, INPUT)).toBeNull();
  });

  it.each([
    "Today is like 11 cigarettes.",
    "Today is like smoking ten a day, stay in",
    "आज दस सिगरेटों जितनी हवा है",
    "like cigs today",
    "धूम्रपान जैसा धुआँ",
    "दो बीड़ियाँ",
  ])("the shared ban flags %s", (text) => {
    expect(bans(text)).toContain("cigarette");
  });

  it("still allows plain no-smoking advice for adults", () => {
    expect(bans("Please avoid smoking indoors today.")).not.toContain("cigarette");
    expect(bans("घर में धूम्रपान न करें।")).not.toContain("cigarette");
  });

  it.each(["सिगरेटों जितना धुआँ", "धूम्रपान जैसा धुआँ", "like cigs today", "No smoking near you today"])(
    "the kid-card check flags %s",
    (text) => {
      expect(kidCardProblems(text)).toContain("cigarette");
    },
  );
});

describe("kid-card health words and worded numbers (AI-5)", () => {
  it.each([
    "Carry your medicine",
    "Carry your medicines",
    "Carry your inhalers",
    "Keep the nebulizer ready",
    "Tell us if you have a cough",
    "डॉक्टर को दिखाएँ",
    "बीमारियों से बचें",
    "दवाइयाँ ले जाएँ",
    "दवाई साथ रखें",
  ])("flags the health text %s", (text) => {
    expect(kidCardProblems(text)).toContain("health");
  });

  it.each(["Play inside for 10 minutes", "Play inside for ten minutes", "दस मिनट अंदर खेलें", "Do twenty jumps"])(
    "flags the number in %s",
    (text) => {
      expect(kidCardProblems(text)).toContain("digits");
    },
  );

  it("keeps friendly kid-library lines and clock times", () => {
    expect(kidCardProblems("Dance to two songs")).toEqual([]);
    expect(kidCardProblems("Play outside at 3 pm")).toEqual([]);
    expect(kidCardProblems("हवा ज़हरीली है")).toContain("fear");
  });
});

describe("harmful advice and links by concept (PT-3)", () => {
  it.each([
    "you can leave the inhaler at home today, masks are unnecessary",
    "Inhaler not required today",
    "आज इनहेलर की ज़रूरत नहीं",
    "Leave the inhaler at home today",
    "No need for a mask this morning",
  ])("flags %s as harmful", (text) => {
    expect(bans(text)).toContain("harmful");
  });

  it.each([
    "Do not leave your inhaler behind today.",
    "Keep the inhaler with you and never leave it at home.",
    "Stop outdoor play and wear a mask.",
  ])("keeps the safe advice %s", (text) => {
    expect(bans(text)).not.toContain("harmful");
  });

  it.each(["bit.ly/free-air or t.me/airdeal", "Book a test at labdeal.xyz today", "tel:9810012345", "see wa.me/919999999999"])(
    "flags the link in %s",
    (text) => {
      expect(bans(text)).toContain("url");
    },
  );

  it("does not take times, PM2.5 or N95 for links", () => {
    expect(bans("Walk at 4 p.m. and wear an N95; PM2.5 is high.")).not.toContain("url");
  });
});
