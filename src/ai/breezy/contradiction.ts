import { contradictions, type ContradictionProblem } from "@/ai/shared/contradiction";
import { containsPhrase } from "@/domain/names/words";
import type { ActivityType } from "@/domain/rules/activities";
import { ruleFactsOf } from "../plan/fields";
import type { PlanInputPerson } from "../plan/schema";

/**
 * The plan's contradiction check on Breezy's free text: a reply that talks about a
 * person's activity must agree with `planActivity` for it. For each person the reply is about (the
 * viewer, or anyone named by token), an Avoid activity may not get a go-word at its usual time, and
 * an activity planned indoors may not get a time today ("दोपहर 3 बजे की सैर आपके लिए बेहतर है।"
 * for Dadaji on the Smog morning is rejected).
 */
const WORDS: Partial<Readonly<Record<ActivityType, readonly string[]>>> = {
  morning_walk: ["walk", "stroll", "सैर", "टहलना", "टहलें"],
  evening_walk: ["walk", "stroll", "सैर", "टहलना", "टहलें"],
  play: ["play", "park", "खेल", "खेलें", "खेलना", "पार्क"],
  sport: ["sport", "cricket", "football", "badminton", "खेलकूद", "क्रिकेट", "फ़ुटबॉल"],
  cycling: ["cycle", "cycling", "साइकिल"],
  errands: ["errand", "errands", "market", "बाज़ार"],
};

const KEPT: readonly ContradictionProblem[] = ["go_word_on_avoid"];

const talksAbout = (text: string, type: ActivityType): boolean => (WORDS[type] ?? []).some((w) => containsPhrase(text, w));

/** The people a reply is about: the viewer plus every token it names. */
function peopleIn(text: string, people: readonly PlanInputPerson[], viewer: string | null): PlanInputPerson[] {
  return people.filter((p) => p.id === viewer || text.includes(`{${p.id}}`));
}

/** Every contradiction between a reply and the rules for the people it is about. */
export function replyContradictions(text: string, people: readonly PlanInputPerson[], viewer: string | null): ContradictionProblem[] {
  return peopleIn(text, people, viewer).flatMap((person) =>
    person.activities.flatMap((activity) => {
      const found = contradictions(text, ruleFactsOf(activity));
      const indoor = activity.rule.suggestion === "indoor" && talksAbout(text, activity.type);
      return found.filter((p) => KEPT.includes(p) || (indoor && p === "time_on_indoor"));
    }),
  );
}
