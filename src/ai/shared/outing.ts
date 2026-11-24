import type { BreezyActivity } from "@/domain/breezy/activity";
import { containsPhrase } from "@/domain/names/words";

/**
 * Outing words: the words that make a clause about going out, mapped to the
 * Breezy activity the rules judge them as. "go", "outside", "terrace" and the like are a moderate `other`; yoga, exercise and running
 * are sport.
 * Used by Breezy's time check and the community message's band check.
 */
const ACTIVITY_WORDS: readonly (readonly [BreezyActivity, readonly string[]])[] = [
  ["walk", ["walk", "walks", "stroll", "jog", "jogging", "सैर", "टहलना", "टहलें", "टहलने"]],
  ["play", ["play", "playing", "park", "खेल", "खेलें", "खेलना", "खेलने", "पार्क"]],
  [
    "sport",
    [
      "sport",
      "sports",
      "cricket",
      "football",
      "badminton",
      "cycling",
      "exercise",
      "exercises",
      "workout",
      "yoga",
      "run",
      "running",
      "खेलकूद",
      "क्रिकेट",
      "फ़ुटबॉल",
      "साइकिल",
      "दौड़",
      "दौड़ें",
      "व्यायाम",
      "कसरत",
      "योग",
    ],
  ],
  ["temple_errand", ["temple", "market", "errand", "errands", "shopping", "मंदिर", "बाज़ार", "दुकान"]],
  [
    "other",
    [
      "go",
      "go out",
      "head out",
      "step out",
      "outside",
      "outdoors",
      "enjoy",
      "terrace",
      "rooftop",
      "roof",
      "lawn",
      "in the open",
      "fresh air",
      "बाहर",
      "चलें",
      "जाएँ",
      "जाएं",
      "घूमें",
      "निकलें",
      "छत",
      "मैदान",
      "खुले में",
    ],
  ],
];

/** The outing a clause talks about, or null when it names none. */
export function activityIn(text: string): BreezyActivity | null {
  return ACTIVITY_WORDS.find(([, words]) => words.some((w) => containsPhrase(text, w)))?.[0] ?? null;
}
