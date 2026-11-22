/**
 * The injected clock (spec 8.3). Domain code never reads the wall clock: live pages pass the real
 * time, recorded demo scenarios pass their `scenarioNow`, and tests pass a fixed instant.
 */
export interface Clock {
  readonly now: Date;
  /** IANA zone, e.g. "Asia/Kolkata". Hourly air data is in the same local time. */
  readonly timeZone: string;
}

export const INDIA_TIME_ZONE = "Asia/Kolkata";

/** Local calendar parts of the clock's instant in its own time zone. */
export interface LocalTime {
  /** "YYYY-MM-DD" */
  readonly date: string;
  readonly hour: number;
  readonly minute: number;
  /** 1–12 */
  readonly month: number;
  readonly day: number;
}

/** Reads the clock's local date and time with `Intl` (pure: depends only on the clock). */
export function localTime(clock: Clock): LocalTime {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: clock.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(clock.now);
  const part = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    date: `${part.year}-${part.month}-${part.day}`,
    hour: Number(part.hour),
    minute: Number(part.minute),
    month: Number(part.month),
    day: Number(part.day),
  };
}

/** Adds whole days to a "YYYY-MM-DD" date (calendar arithmetic in UTC, so no DST surprises). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** The weekday of a "YYYY-MM-DD" date. */
export function weekdayOf(date: string): Weekday {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Hours between two instants (positive when `later` is after `earlier`). */
export function hoursBetween(earlier: Date, later: Date): number {
  return (later.getTime() - earlier.getTime()) / 3_600_000;
}
