import type { Band } from "../air/bands";
import { kidCard, toneOf, type KidCard } from "../libraries/kid";
import type { Lang } from "../time/format";
import type { PersonPlan } from "./people";

/** The kid "Why?" fact for the card's main change: cold mornings for a moved time, enclosed travel for a switch. */
function kidFactFor(plan: PersonPlan): string | null {
  const suggestion = plan.headline?.plan.suggestion;
  if (suggestion === "switch_mode") return "metro_exposure";
  if (suggestion === "move_time" || suggestion === "indoor") return "morning_inversion";
  return null;
}

/**
 * A dependent's kid card from their rule results: kid tone under 13, teen tone 13–17,
 * one line per activity, the face in the band of the air now. Text only from the kid library.
 */
export function kidCardFor(plan: PersonPlan, band: Band, lang: Lang, hour: number, date: string): KidCard {
  return kidCard({
    band,
    tone: toneOf(plan.person.ageGroup === "under13" ? "under13" : "13to17"),
    lang,
    hour,
    date,
    items: plan.items.map(({ activity, plan: rule }) => ({ type: activity.type, plan: rule, mainMode: plan.person.travel.main })),
    factId: kidFactFor(plan),
  });
}
