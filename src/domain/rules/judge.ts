import { intensityOf, spanHours } from "./activities";
import type { Judge } from "./bestHour";
import type { Mode } from "./modes";
import type { PlanStep } from "./plan";

/** The judge for an activity in the given mode (the person's usual mode by default). */
export function judgeFor(step: Pick<PlanStep, "activity" | "person" | "env">, mode: Mode = step.person.travel.main): Judge {
  const { activity, person, env } = step;
  return {
    index: env.index,
    group: person.group,
    ctx: env.ctx,
    intensity: intensityOf(activity.type, activity.duration, mode),
    span: spanHours(activity.duration),
  };
}
