import { pointAt, type HourIndex } from "../air/hourly";
import { DAY_FIRST_HOUR, DAY_LAST_HOUR } from "../air/windows";
import type { Flex, Intensity } from "./activities";
import { ruleBand, type RuleContext } from "./context";
import type { Group } from "./groups";
import { verdict, verdictRank, worstVerdict, type Verdict } from "./verdict";

/** Everything needed to judge one activity at any hour. */
export interface Judge {
  readonly index: HourIndex;
  readonly group: Group;
  readonly intensity: Intensity;
  /** Clock hours the activity touches (1 or 2). */
  readonly span: number;
  readonly ctx: RuleContext;
}

export interface HourJudgement {
  readonly hour: number;
  /** The worst verdict over the activity's hours. */
  readonly verdict: Verdict;
  /** The worst AQI over the activity's hours. */
  readonly worstAqi: number;
}

/**
 * Judges an activity starting at `hour`: the worst hour in h…h+span−1 decides (spec 8.4 step 3),
 * each hour through the guardrail table with the winter caution. Null if any of those hours has no data.
 */
export function judgeAt(judge: Judge, date: string, hour: number): HourJudgement | null {
  const verdicts: Verdict[] = [];
  let worstAqi = 0;
  for (let h = hour; h < hour + judge.span; h++) {
    const point = h <= 23 ? pointAt(judge.index, date, h) : undefined;
    if (!point) return null;
    verdicts.push(verdict(ruleBand(point.band, judge.group, judge.ctx), judge.group, judge.intensity));
    worstAqi = Math.max(worstAqi, point.aqi);
  }
  return { hour, verdict: worstVerdict(verdicts), worstAqi };
}

/**
 * Candidate start hours (spec 8.4 step 2): 06–21, never before `fromHour` (past hours are never
 * suggested). Fixed → the usual hour only; Can move a bit → usual ± 2 h; Any time → all of them.
 */
export function candidateHours(flex: Flex, usualHour: number, fromHour: number): number[] {
  const hours: number[] = [];
  for (let h = Math.max(DAY_FIRST_HOUR, fromHour); h <= DAY_LAST_HOUR; h++) {
    if (flex === "fixed" && h !== usualHour) continue;
    if (flex === "some" && Math.abs(h - usualHour) > 2) continue;
    hours.push(h);
  }
  return hours;
}

/** Lowest (verdict rank, worst AQI, distance from the usual hour, hour) wins (spec 8.4 step 4). */
export function bestHour(judge: Judge, date: string, hours: readonly number[], usualHour: number): HourJudgement | null {
  const judged = hours.map((h) => judgeAt(judge, date, h)).filter((j): j is HourJudgement => j !== null);
  judged.sort(
    (a, b) =>
      verdictRank(a.verdict) - verdictRank(b.verdict) ||
      a.worstAqi - b.worstAqi ||
      Math.abs(a.hour - usualHour) - Math.abs(b.hour - usualHour) ||
      a.hour - b.hour,
  );
  return judged[0] ?? null;
}

/** "At least 20% and at least 25 points lower" for a move at the same verdict (spec 8.4 step 5). */
export const MOVE_MIN_SHARE = 0.2;
export const MOVE_MIN_POINTS = 25;

/**
 * Suggest a move only to a non-Avoid hour that is better than the usual one: a better verdict, or the
 * same verdict with a worst AQI at least 20% and 25 points lower. Avoids "move by one hour" noise.
 */
export function worthMoving(best: HourJudgement, usual: HourJudgement): boolean {
  if (best.verdict === "avoid" || best.hour === usual.hour) return false;
  if (verdictRank(best.verdict) < verdictRank(usual.verdict)) return true;
  if (best.verdict !== usual.verdict) return false;
  const drop = usual.worstAqi - best.worstAqi;
  return drop >= MOVE_MIN_POINTS && drop >= usual.worstAqi * MOVE_MIN_SHARE;
}
