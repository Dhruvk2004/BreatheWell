import type { Activity, TripLength } from "../rules/activities";
import { sensitivityGroup, type AgeGroup, type Condition, type Group } from "../rules/groups";
import type { Mode } from "../rules/modes";
import type { ActivityPlan, PlanEnv } from "../rules/plan";
import { planActivity } from "../rules/planActivity";
import { verdictRank } from "../rules/verdict";

/** A family member or dependent as the rules see them: no name, only what the plan needs. */
export interface FamilyPerson {
  /** Member uid or dependent id; in prompts a token (`m1`, `d1`). */
  readonly id: string;
  readonly kind: "adult" | "dependent";
  readonly ageGroup: AgeGroup;
  readonly conditions: readonly Condition[];
  readonly activities: readonly Activity[];
  readonly travel: { readonly main: Mode; readonly tripLength: TripLength; readonly others: readonly Mode[] };
}

/** One activity with its rule result. */
export interface PlannedActivity {
  readonly activity: Activity;
  readonly plan: ActivityPlan;
}

/** A person's rule results for the day; `headline` is the row's chip and line. */
export interface PersonPlan {
  readonly person: FamilyPerson;
  readonly group: Group;
  readonly items: readonly PlannedActivity[];
  readonly headline: PlannedActivity | null;
}

/** The row shows the activity that needs the most care: the worst verdict at the usual time, then the earliest. */
function headlineOf(items: readonly PlannedActivity[]): PlannedActivity | null {
  const sorted = [...items].sort(
    (a, b) => verdictRank(b.plan.verdictAtUsual) - verdictRank(a.plan.verdictAtUsual) || a.plan.usualHour - b.plan.usualHour,
  );
  return sorted[0] ?? null;
}

/**
 * Plans every activity of one person with the rules engine. Activities without air
 * data for their usual hour get no verdict and are left out.
 */
export function planPerson(person: FamilyPerson, env: PlanEnv): PersonPlan {
  const group = sensitivityGroup(person.ageGroup, person.conditions);
  const planned = { group, travel: person.travel };
  const items = person.activities.flatMap((activity) => {
    const plan = planActivity(planned, activity, env);
    return plan ? [{ activity, plan }] : [];
  });
  return { person, group, items, headline: headlineOf(items) };
}

const ORDER = (p: PersonPlan, viewerId: string | null): number => {
  if (p.person.id === viewerId) return 0;
  if (p.person.kind === "dependent") return 3;
  return p.group === "extra" ? 1 : 2;
};

/** Row order on Today and the demo: me, extra care, other adults, then children and teens. */
export function orderRows(plans: readonly PersonPlan[], viewerId: string | null): PersonPlan[] {
  return plans
    .map((plan, i) => ({ plan, i }))
    .sort((a, b) => ORDER(a.plan, viewerId) - ORDER(b.plan, viewerId) || a.i - b.i)
    .map(({ plan }) => plan);
}
