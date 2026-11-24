import { wordsOf } from "../names/words";

/**
 * The cigarette comparison (section 9 safety rules) never appears in a shared message, a
 * Breezy reply or on a kid card. One list for every check: word stems, so plurals
 * and Hindi inflections are caught ("सिगरेटों", "बीड़ियाँ"), and "smoking" when it is compared ("like
 * smoking ten a day", "धूम्रपान जैसा"). Plain "no smoking indoors" advice stays allowed for adults.
 */
const STEMS = ["cigarette", "cigar", "ciggie", "ciggy", "सिगरेट", "सिग्रेट", "बीड़ी", "बीड़ि", "बीडी", "बीडि"].map((w) =>
  w.normalize("NFC"),
);
const WORDS = new Set(["cig", "cigs", "fags", "bidi", "bidis", "beedi", "beedis"]);
const SMOKING = new Set(["smoking", "smoked", "धूम्रपान"]);
const COMPARE = new Set([
  "like",
  "equal",
  "equals",
  "equivalent",
  "same",
  "जैसा",
  "जैसी",
  "जैसे",
  "जितना",
  "जितनी",
  "जितने",
  "बराबर",
  "समान",
]);
const NUMBER = /^\d+$/u;
const NUMBER_WORDS = new Set([
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "एक",
  "दो",
  "तीन",
  "चार",
  "पांच",
  "पाँच",
  "दस",
]);
const NEAR = 3;

/** True when the word is a cigarette or bidi word in any form. */
const isCigaretteWord = (word: string): boolean => WORDS.has(word) || STEMS.some((stem) => word.startsWith(stem));

/** True when a "smoking" word is compared to the air: a comparison word or a count next to it. */
function comparedSmoking(words: readonly string[], i: number): boolean {
  const around = words.slice(Math.max(0, i - NEAR), i + NEAR + 1);
  return around.some((w) => COMPARE.has(w) || NUMBER.test(w) || NUMBER_WORDS.has(w));
}

/** True when the text names cigarettes or bidis, or compares the air to smoking. */
export function mentionsCigarette(text: string): boolean {
  const words = wordsOf(text);
  return words.some((w, i) => isCigaretteWord(w) || (SMOKING.has(w) && comparedSmoking(words, i)));
}

/** True when the text says "smoking" at all (kid cards never do). */
export const mentionsSmoking = (text: string): boolean => wordsOf(text).some((w) => SMOKING.has(w));
