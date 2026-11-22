/**
 * More word lists for the breathing-emergency check (stage 7 AI-2), in the check's normal form:
 * "inhaler is not helping", "inhaler se aaram nahi", "इनहेलर से आराम नहीं".
 */

/** Inhaler and nebuliser words. */
export const INHALER_WORDS: ReadonlySet<string> = new Set([
  "inhaler",
  "inhalers",
  "pump",
  "nebulizer",
  "nebuliser",
  "nebulizers",
  "nebulisers",
  "इनहेलर",
  "पंप",
  "नेबुलाइजर",
]);

/** Words that, with a negation, say the inhaler does not work. */
export const INHALER_FAILING: ReadonlySet<string> = new Set([
  "helping",
  "help",
  "helps",
  "helped",
  "working",
  "work",
  "works",
  "worked",
  "aaram",
  "araam",
  "aram",
  "asar",
  "kaam",
  "आराम",
  "असर",
  "काम",
]);

/** Negations ("isn't" is "isnt" in the check's normal form). */
export const NEGATIONS: ReadonlySet<string> = new Set([
  "not",
  "isnt",
  "doesnt",
  "didnt",
  "wont",
  "no",
  "nahi",
  "nhi",
  "nahin",
  "nai",
  "नहीं",
  "नही",
  "ना",
]);
