import { pointAt, type HourIndex } from "../air/hourly";
import { DURATION_HOURS, isTravel, type Activity } from "../rules/activities";
import { isEnclosed, type Mode } from "../rules/modes";
import type { ActivityPlan } from "../rules/plan";
import { parseHhMm } from "../time/format";

/**
 * Place factors (assumptions to verify, 12.2 Q4): outdoors or open travel 1.0, enclosed
 * travel 0.5, indoors with windows shut 0.7, the purifier room at night 0.35.
 */
export const PLACE_FACTOR = { outdoor: 1, enclosed: 0.5, indoor: 0.7, purifierRoom: 0.35 } as const;

/** Night hours 22:00–06:00 are in the purifier room for an Extra care member with a purifier. */
export const isNightHour = (hour: number): boolean => hour >= 22 || hour < 6;

/** Time outside the home: start in hours (6.5 = 06:30), length in hours, place factor. */
export interface Outing {
  readonly start: number;
  readonly hours: number;
  readonly factor: number;
}

export interface Segment {
  readonly fraction: number;
  readonly factor: number;
}

/** One entry per hour 0–23: the parts of the hour and the place factor of each part. */
export type Schedule = readonly (readonly Segment[])[];

/** Whether the nights count as the purifier room (purifier at home and the member is Extra care). */
export interface HomeNight {
  readonly purifierRoom: boolean;
}

/**
 * The outings' parts of one hour. Overlapping outings cannot fill more than the whole hour, so when
 * their parts add up to more than 1 they share it in proportion (one person, one place at a time).
 */
function outingParts(outings: readonly Outing[], hour: number): Segment[] {
  const parts = outings
    .map((o) => ({ fraction: Math.max(0, Math.min(hour + 1, o.start + o.hours) - Math.max(hour, o.start)), factor: o.factor }))
    .filter((s) => s.fraction > 0);
  const total = parts.reduce((sum, s) => sum + s.fraction, 0);
  return total > 1 ? parts.map((s) => ({ ...s, fraction: s.fraction / total })) : parts;
}

/**
 * `exposureSchedule`: where the person is in each hour of the day. Outings use their
 * factor for the part of each hour they cover; the rest of the hour is indoors (0.7), or the
 * purifier room (0.35) at night when `home.purifierRoom`.
 */
export function exposureSchedule(outings: readonly Outing[], home: HomeNight): Schedule {
  return Array.from({ length: 24 }, (_, hour) => {
    const parts = outingParts(outings, hour);
    const rest = 1 - parts.reduce((sum, s) => sum + s.fraction, 0);
    const base = home.purifierRoom && isNightHour(hour) ? PLACE_FACTOR.purifierRoom : PLACE_FACTOR.indoor;
    return rest > 0 ? [...parts, { fraction: rest, factor: base }] : parts;
  });
}

/** Today's 24 hourly PM2.5 values, or null if any hour is missing. */
export function dayPm25(index: HourIndex, date: string): number[] | null {
  const values = Array.from({ length: 24 }, (_, h) => pointAt(index, date, h)?.pm25 ?? null);
  return values.every((v): v is number => v !== null) ? values : null;
}

/** exposureToday = Σ_h(PM2.5_h × Σ(fraction × factor)) / 24, in µg/m³. */
export function exposureToday(pm25: readonly number[], schedule: Schedule): number {
  const total = schedule.reduce((sum, segments, h) => sum + pm25[h] * segments.reduce((s, seg) => s + seg.fraction * seg.factor, 0), 0);
  return total / 24;
}

/** "Outside all day": every hour at factor 1.0, i.e. the day's mean PM2.5. */
export const outsideAllDay = (pm25: readonly number[]): number => pm25.reduce((a, b) => a + b, 0) / pm25.length;

/** The place factor of a trip in a mode, or of any other outdoor activity (1.0). */
function outingFactor(activity: Activity, mode: Mode): number {
  return isTravel(activity.type) && isEnclosed(mode) ? PLACE_FACTOR.enclosed : PLACE_FACTOR.outdoor;
}

/** Before = usual times and usual modes. Trips from home ("work from home") are not outings. */
export function beforeOutings(activities: readonly Activity[], mode: Mode): Outing[] {
  return activities
    .filter((a) => !(isTravel(a.type) && mode === "home"))
    .map((a) => {
      const { hour, minute } = parseHhMm(a.usual);
      return { start: hour + minute / 60, hours: DURATION_HOURS[a.duration], factor: outingFactor(a, mode) };
    });
}

/** After = the plan's suggested times and modes; indoor suggestions leave no outing. */
export function afterOutings(activities: readonly Activity[], mode: Mode, plans: readonly ActivityPlan[]): Outing[] {
  return activities.flatMap((a) => {
    const plan = plans.find((p) => p.activityId === a.id);
    if (plan?.suggestion === "indoor") return [];
    const [before] = beforeOutings([a], plan?.switchTo ?? mode);
    if (!before) return [];
    return [plan?.suggestion === "move_time" && plan.bestTime !== null ? { ...before, start: plan.bestTime } : before];
  });
}
