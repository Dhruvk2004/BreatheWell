import { stricterBand, type Band } from "../air/bands";
import { localTime, type Clock } from "../time/clock";
import type { Group } from "./groups";

/** Where the place is: an Indo-Gangetic Plain city, elsewhere in India, or outside India (spec 8.3, 8.5). */
export type Region = "igp" | "india" | "outside_india";

/** Inputs to the winter caution (spec 8.3 override 4): `{month, region, hasStation}` as in the spec. */
export interface RuleContext {
  /** Month (1–12) of the day being planned. */
  readonly month: number;
  readonly region: Region;
  /** A CPCB station value is available (S1); then the rules use the higher value instead. */
  readonly hasStation: boolean;
}

/** Builds the rule context for a place at the clock's local date. */
export function ruleContext(clock: Clock, region: Region, hasStation: boolean): RuleContext {
  const local = localTime(clock);
  return { month: local.month, region, hasStation };
}

/** The same context for another date ("YYYY-MM-DD"), e.g. the day being planned. */
export function contextOn(ctx: RuleContext, date: string): RuleContext {
  return { ...ctx, month: Number(date.slice(5, 7)) };
}

/** 1 Nov to the end of February (spec 8.3 override 4 says 28 Feb; 29 Feb in a leap year is included). */
export const isWinter = (month: number): boolean => month === 11 || month === 12 || month === 1 || month === 2;

/** True when an Extra care member's verdicts use the band one step stricter. */
export function winterCautionApplies(group: Group, ctx: RuleContext): boolean {
  return group === "extra" && ctx.region === "igp" && !ctx.hasStation && isWinter(ctx.month);
}

/**
 * The band the rules use: the model band, one step stricter under the winter caution, because model
 * data can read lower than Delhi stations during smog.
 */
export function ruleBand(band: Band, group: Group, ctx: RuleContext): Band {
  return winterCautionApplies(group, ctx) ? stricterBand(band) : band;
}
