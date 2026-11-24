import { containsPhrase, wordsOf } from "../../names/words";
import { mentionsCigarette, mentionsSmoking } from "../../safety/cigarette";
import { numberWordsToDigits } from "../../text/numbers";

/**
 * Kid-card checks: no digits except clock times, no air units, no
 * cigarette, fear or health words. Kid library lines and adult-confirmed Breezy items for a
 * dependent must pass them to appear on the card.
 */
export type KidProblem = "digits" | "air_units" | "cigarette" | "fear" | "health";

/** Clock times a kid card may show: "3 pm", "6:30 am", "2–4 pm", "दोपहर 3 बजे", "3–4 बजे". */
// The meridiem or बजे must end the word, so "10 amazing games" still counts as a digit.
const CLOCK_TIME = /\d{1,2}(?::\d{2})?(?:\s*[–-]\s*\d{1,2}(?::\d{2})?)?\s*(?:am|pm|a\.m\.|p\.m\.|बजे)(?![\p{L}\p{M}])/giu;
const DEVANAGARI_DIGIT = /[०-९]/u;
const AIR_UNITS = /(µg|μg|ug\/m|\baqi\b|\bpm\s?2\.?5\b|\bpm\s?10\b|माइक्रोग्राम|एक्यूआई)/iu;

const FEAR = [
  "die",
  "dies",
  "dying",
  "death",
  "dead",
  "cancer",
  "kill",
  "kills",
  "poison",
  "poisonous",
  "toxic",
  "मौत",
  "मरना",
  "कैंसर",
  "ज़हर",
  "जहर",
  "ज़हरीली",
  "जहरीली",
  "ज़हरीला",
  "जहरीला",
];
/** Health words, whole (exact) and as stems, so plurals and Hindi inflections count. */
const HEALTH = ["ill", "pump", "pumps", "pill", "pills", "tablet", "tablets", "cough", "दमा", "खांसी", "खाँसी"];
const HEALTH_STEMS = [
  "asthma",
  "inhaler",
  "disease",
  "sick",
  "illness",
  "hospital",
  "medicine",
  "medication",
  "doctor",
  "nebuli",
  "coughing",
  "इनहेलर",
  "बीमार",
  "अस्पताल",
  "दवा",
  "डॉक्टर",
  "डाक्टर",
  "नेबुला",
].map((w) => w.normalize("NFC"));

const hasStem = (text: string, stems: readonly string[]) => wordsOf(text).some((w) => stems.some((s) => w.startsWith(s)));

/**
 * A number in words that is a duration or count a kid card may not show ("ten minutes", "दस मिनट",
 * "twenty laps": stage 7 AI-5). Small friendly counts from the kid library ("two songs") stay.
 */
const DURATION = /\d+\s*(?:minutes?|mins?|hours?|hrs?|मिनट|घंटे|घंटा)(?![\p{L}\p{M}])/iu;
function wordedNumber(text: string): boolean {
  const digits = numberWordsToDigits(text.replace(CLOCK_TIME, " "));
  if (digits === text.replace(CLOCK_TIME, " ")) return false;
  return DURATION.test(digits) || [...digits.matchAll(/\d+/gu)].some((m) => Number(m[0]) >= 10);
}

const hasAny = (text: string, words: readonly string[]) => words.some((w) => containsPhrase(text, w));

/** Every problem the text has for a kid card (empty = the text may appear on the card). */
export function kidCardProblems(text: string): KidProblem[] {
  const problems: KidProblem[] = [];
  const withoutTimes = text.replace(CLOCK_TIME, " ");
  if (/\d/.test(withoutTimes) || DEVANAGARI_DIGIT.test(text) || wordedNumber(text)) problems.push("digits");
  if (AIR_UNITS.test(text)) problems.push("air_units");
  if (mentionsCigarette(text) || mentionsSmoking(text)) problems.push("cigarette");
  if (hasAny(text, FEAR)) problems.push("fear");
  if (hasAny(text, HEALTH) || hasStem(text, HEALTH_STEMS)) problems.push("health");
  return problems;
}

/** True when the text passes every kid-card check. */
export const passesKidChecks = (text: string): boolean => kidCardProblems(text).length === 0;
