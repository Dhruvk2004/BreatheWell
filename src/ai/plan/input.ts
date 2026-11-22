import { bandOfAqi } from "@/domain/air/bands";
import type { HourPoint } from "@/domain/air/hourly";
import type { HourWindow } from "@/domain/air/windows";
import type { WeatherWhy } from "@/domain/air/weatherWhy";
import type { FamilyDay } from "@/domain/family/familyDay";
import type { FamilyPerson, PersonPlan } from "@/domain/family/people";
import { swapOptions } from "@/domain/family/swaps";
import { isFactId } from "@/domain/impact/facts";
import { alternativeById } from "@/domain/libraries/alternatives";
import type { HomeSetup } from "@/domain/libraries/homeSetup";
import { tipById } from "@/domain/libraries/tips";
import { careTagOf } from "@/domain/rules/groups";
import type { Lang } from "@/domain/time/format";
import type { PlanInput, PlanInputActivity, PlanInputPerson } from "./schema";

/**
 * Builds the family plan prompt input from the rules' day (spec 7.2) and pseudonymises it: members
 * become `m1`…, dependents `d1`…, activities `a1`…, in the family's stored order (not the viewer's
 * row order), so every member's request builds the same prompt. Names, uids, dependent ids and
 * condition names are never in it, and members still setting up are not planned, so not sent.
 */
export interface PlanSource {
  readonly day: FamilyDay;
  /** Planned people in the family's stored order: onboarded adults, then dependents. */
  readonly people: readonly FamilyPerson[];
  /** Each adult's language, by id. */
  readonly languageOf: Readonly<Record<string, Lang>>;
  /** Every member's language plus the admin's (spec 7.2: only the languages the family uses). */
  readonly languages: readonly Lang[];
  readonly place: string;
  readonly home: HomeSetup;
  readonly weatherWhy: WeatherWhy | null;
}

/** Token → real id, kept on the server to map Gemini's answer back (never sent). */
export interface TokenMap {
  readonly people: Readonly<Record<string, string>>;
  readonly activities: Readonly<Record<string, { readonly personId: string; readonly activityId: string }>>;
  /** Person token → the token of the activity their Today row shows (the row line must agree with it). */
  readonly headline: Readonly<Record<string, string>>;
}

export interface PlanRequest {
  readonly input: PlanInput;
  readonly tokens: TokenMap;
}

const CORE_FACTS = ["morning_inversion", "n95_fit", "metro_exposure"];

const hhmm = (hour: number): string => `${String(hour).padStart(2, "0")}:00`;
const windowText = (w: HourWindow | null): string | null => (w ? `${hhmm(w.start)}-${hhmm(w.end)}` : null);

/** Hour bands for the prompt (spec 7.2 `hourBand`). */
export function hourBand(hour: number): PlanInputActivity["hourBand"] {
  if (hour < 7) return "early_morning";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return hour < 21 ? "evening" : "night";
}

function role(person: FamilyPerson): PlanInputPerson["role"] {
  if (person.kind === "dependent") return person.ageGroup === "under13" ? "child" : "teen";
  return person.ageGroup === "60plus" ? "grandparent" : "adult";
}

function activitiesOf(row: PersonPlan, next: () => string, map: Record<string, TokenMap["activities"][string]>): PlanInputActivity[] {
  return row.items.map(({ activity, plan }) => {
    const id = next();
    map[id] = { personId: row.person.id, activityId: activity.id };
    const rule = {
      verdictAtUsual: plan.verdictAtUsual,
      suggestion: plan.suggestion,
      bestTime: plan.bestTime === null ? null : hhmm(plan.bestTime),
      verdictAtBest: plan.verdictAtBest,
      switchTo: plan.switchTo,
    };
    return { id, type: activity.type, usual: activity.usual, hourBand: hourBand(plan.usualHour), rule };
  });
}

/** The pseudonymised prompt input and its token map; null when the rules planned nobody (no air data). */
export function planRequest(src: PlanSource): PlanRequest | null {
  const { day } = src;
  const now = day.summary.now;
  if (!now || day.rows.length === 0) return null;
  const people: Record<string, string> = {};
  const activities: Record<string, TokenMap["activities"][string]> = {};
  const headline: Record<string, string> = {};
  const counters = { m: 0, d: 0, a: 0 };
  const nextActivity = () => `a${++counters.a}`;
  const members = src.people.flatMap((person): PlanInputPerson[] => {
    const row = day.rows.find((r) => r.person.id === person.id);
    if (!row || row.items.length === 0) return [];
    const prefix = person.kind === "adult" ? "m" : "d";
    const token = `${prefix}${++counters[prefix]}`;
    people[token] = person.id;
    const planned = activitiesOf(row, nextActivity, activities);
    headline[token] = planned[row.items.findIndex((i) => i === row.headline)].id;
    const language = person.kind === "adult" ? src.languageOf[person.id] : undefined;
    return [
      {
        id: token,
        role: role(person),
        ageGroup: person.ageGroup,
        care: careTagOf(row.group),
        ...(language ? { language } : {}),
        travel: person.travel.main,
        activities: planned,
        alternatives: swapOptions(person, day.summary, src.home, day.severeDay).map((a) => a.id),
      },
    ];
  });
  return { input: inputOf(src, members, now), tokens: { people, activities, headline } };
}

function inputOf(src: PlanSource, members: readonly PlanInputPerson[], now: HourPoint): PlanInput {
  const { summary } = src.day;
  const alternatives = [...new Set([...members.flatMap((m) => m.alternatives), src.day.together])];
  const facts = [
    ...CORE_FACTS,
    ...src.day.homeTips.map((id) => tipById(id).factId),
    ...alternatives.map((id) => alternativeById(id)?.factId ?? ""),
  ];
  return {
    date: summary.date,
    place: src.place,
    air: {
      nowBand: now.band,
      avg24Band: summary.avg24 === null ? null : bandOfAqi(summary.avg24),
      mainPollutant: now.main,
      bestWindow: windowText(summary.best),
      worstWindow: windowText(summary.worst),
      weatherWhy: src.weatherWhy,
    },
    home: src.home,
    members,
    languages: src.languages,
    allowedTips: src.day.homeTips,
    together: src.day.together,
    allowedAlternatives: alternatives,
    allowedFacts: [...new Set(facts)].filter(isFactId),
  };
}
