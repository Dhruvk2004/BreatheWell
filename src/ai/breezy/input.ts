import type { ClockTime } from "@/ai/shared/times";
import type { AirSummary } from "@/domain/air/summary";
import { DAY_FIRST_HOUR, DAY_LAST_HOUR } from "@/domain/air/windows";
import type { Lang } from "@/domain/time/format";
import { allowedTimes } from "../plan/validate";
import type { PlanCheck } from "../plan/validate";
import { outlookInput, type BreezyInput } from "./schema";
import type { HourAllowed } from "./timeCheck";
import type { BreezyCheck } from "./validate";

/**
 * Breezy's context from the family plan request (spec 7.7.8): the same pseudonymised people (tokens,
 * roles, care tags, activities with their rule results), the air as band words, today's hourly bands
 * and the 5-day outlook. Built from `PlanCheck`, so a name can never reach Breezy by another path.
 */
export interface BreezySource {
  readonly plan: PlanCheck;
  readonly summary: AirSummary;
  /** The viewer's token, or null when the viewer is not planned (still setting up). */
  readonly viewer: string | null;
  readonly viewerLanguage: Lang;
  /** The rules for a token, activity and hour (from the family's day on the server). */
  readonly allowed: HourAllowed;
}

/** Every whole and half hour of the day: Breezy may name any clock time, never another number. */
export function dayTimes(): ClockTime[] {
  const times: ClockTime[] = [];
  for (let hour = DAY_FIRST_HOUR; hour <= DAY_LAST_HOUR; hour++) times.push({ hour, minute: 0 }, { hour, minute: 30 });
  return times;
}

/** The Breezy check: the input Gemini gets plus what its reply is checked against. */
export function breezyCheck(src: BreezySource): BreezyCheck {
  const { input } = src.plan.request;
  const breezyInput: BreezyInput = {
    viewer: src.viewer,
    viewerLanguage: src.viewerLanguage,
    date: input.date,
    place: input.place,
    air: input.air,
    todayBands: src.summary.today.map((p) => p?.band ?? null),
    outlook: outlookInput(src.summary.outlook),
    people: input.members,
    home: input.home,
    allowedFacts: input.allowedFacts,
  };
  return {
    input: breezyInput,
    names: src.plan.names,
    nameOf: src.plan.nameOf,
    allowedTimes: [...allowedTimes(src.plan.request), ...dayTimes()],
    allowed: src.allowed,
  };
}
