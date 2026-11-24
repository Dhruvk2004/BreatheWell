import type { CardDate, HourAllowed } from "@/ai/breezy/timeCheck";
import { checkCardTime, type CardTime } from "@/domain/breezy/cardTime";
import type { BreezyActivity } from "@/domain/breezy/activity";
import type { FamilyDay } from "@/domain/family/familyDay";
import type { PersonPlan } from "@/domain/family/people";
import type { Region, RuleContext } from "@/domain/rules/context";
import { addDays } from "@/domain/time";

/**
 * The rules for one Breezy time: a person's slot for an activity at an hour,
 * and the `HourAllowed` judge the validator and the action route use on every time in free text.
 */
export interface DayRules {
  readonly day: FamilyDay;
  readonly ctx: RuleContext;
}

export interface Slotting {
  readonly ctx: DayRules;
  readonly date: CardDate;
  readonly activity: BreezyActivity;
  readonly hour: number;
}

/** The rule context of a family's day (the month is set per card date by `contextOn`). */
export const ruleContextOf = (date: string, region: Region): RuleContext => ({
  month: Number(date.slice(5, 7)),
  region,
  hasStation: false,
});

/** The rule's answer for one person and card time (from the next full hour today). */
export function slotFor(row: PersonPlan, s: Slotting): CardTime {
  const { summary } = s.ctx.day;
  const today = s.date === "today";
  return checkCardTime({
    index: summary.index,
    group: row.group,
    ctx: s.ctx.ctx,
    activity: s.activity,
    mode: row.person.travel.main,
    date: today ? summary.date : addDays(summary.date, 1),
    hour: s.hour,
    fromHour: today ? summary.hour + 1 : 0,
  });
}

/**
 * The judge for free-text times: true when the rules keep this hour for the person (not Avoid, not
 * past, not a Severe day). `idOf` maps a prompt token to the person's id; ids map to themselves.
 * Without a planned day nothing is allowed, so an outing at a time is never offered blind.
 */
export function hourAllowedFor(rules: DayRules | null, idOf: Readonly<Record<string, string>> = {}): HourAllowed {
  return (person, activity, date, hour) => {
    if (!rules) return false;
    const id = idOf[person] ?? person;
    const row = rules.day.rows.find((r) => r.person.id === id);
    return row ? slotFor(row, { ctx: rules, date, activity, hour }).kind === "keep" : false;
  };
}
