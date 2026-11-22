/**
 * Clock times inside generated text, in every allowed format: "3 pm", "6:30 am", "2–4 pm",
 * "15:00", "दोपहर 3 बजे", "2–4 बजे", Hinglish "subah 8 baje" and spoken "8 o'clock", "8 in the
 * morning". Number words and Devanagari digits are turned into digits by the callers first. The validator lets a number through only when it is one of
 * the input's allowed times (spec 7.1), and the contradiction checks look for the rule's times.
 */
export interface FoundTime {
  /** The matched text. */
  readonly text: string;
  /** Possible 24-hour readings of each endpoint (a bare "3 बजे" may be 3:00 or 15:00). */
  readonly hours: readonly (readonly number[])[];
  readonly minutes: readonly number[];
}

const morning = (h: number) => (h === 12 ? 0 : h);
const afternoon = (h: number) => (h < 12 ? h + 12 : h);
const night = (h: number) => (h >= 8 && h < 12 ? h + 12 : h === 12 ? 0 : h);
/** Day parts in Hindi, Hinglish and English ("सुबह 8 बजे", "subah 8 baje", "8 in the morning"). */
const PARTS: Record<string, (h: number) => number> = {
  सुबह: morning,
  subah: morning,
  subeh: morning,
  morning,
  दोपहर: afternoon,
  dopahar: afternoon,
  dopehar: afternoon,
  afternoon,
  शाम: afternoon,
  shaam: afternoon,
  sham: afternoon,
  evening: afternoon,
  रात: night,
  raat: night,
  night,
  tonight: night,
};

const HM = String.raw`(\d{1,2})(?::(\d{2}))?`;
const DASH = String.raw`\s*(?:–|-|to|से)\s*`;
const EN_RANGE = new RegExp(`${HM}(?:${DASH}${HM})?\\s*(a\\.?m\\.?|p\\.?m\\.?)(?![\\p{L}])`, "giu");
const HI_PART = "सुबह|दोपहर|शाम|रात|subah|subeh|dopahar|dopehar|shaam|sham|raat";
const HI_RANGE = new RegExp(`(?:(${HI_PART})\\s+)?${HM}(?:${DASH}${HM})?\\s*(?:बजे|baje|bje)(?![\\p{L}\\p{M}])`, "giu");
const H24 = /(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:]|\s*(?:am|pm|a\.m|p\.m|बजे|baje))/giu;
// Spoken English (stage 7 AI-1): "8 o'clock (this morning)", "8 in the morning", "8 this evening", "8 tonight".
const DAY_PART = String.raw`(?:\s+(?:in\s+the|this|at)\s+(morning|afternoon|evening|night)|\s+(tonight))`;
const OCLOCK = new RegExp(`(?<![\\d.:])${HM}\\s*o['’]?\\s?clock${DAY_PART}?(?![\\p{L}])`, "giu");
const SPOKEN = new RegExp(`(?<![\\d.:])${HM}${DAY_PART}(?![\\p{L}])`, "giu");

/** Readings of an hour with a day part, or both halves of the day without one. */
const readingsOf =
  (part: string | undefined) =>
  (h: number): number[] => {
    const fn = part ? PARTS[part.toLowerCase()] : undefined;
    return fn ? [fn(h)] : h === 12 ? [12, 0] : [h, h + 12];
  };

const enHour = (h: number, pm: boolean) => (h % 12) + (pm ? 12 : 0);

function englishTimes(text: string): FoundTime[] {
  return [...text.matchAll(EN_RANGE)].map((m) => {
    const pm = m[5].toLowerCase().startsWith("p");
    const ends = [m[1], m[3]].filter((v): v is string => v !== undefined).map(Number);
    return { text: m[0], hours: ends.map((h) => [enHour(h, pm)]), minutes: [Number(m[2] ?? 0), Number(m[4] ?? 0)].slice(0, ends.length) };
  });
}

function hindiTimes(text: string): FoundTime[] {
  return [...text.matchAll(HI_RANGE)].map((m) => {
    const ends = [m[2], m[4]].filter((v): v is string => v !== undefined).map(Number);
    return { text: m[0], hours: ends.map(readingsOf(m[1])), minutes: [Number(m[3] ?? 0), Number(m[5] ?? 0)].slice(0, ends.length) };
  });
}

function spokenTimes(text: string): FoundTime[] {
  return [...text.matchAll(OCLOCK), ...text.matchAll(SPOKEN)].map((m) => ({
    text: m[0],
    hours: [readingsOf(m[3] ?? m[4])(Number(m[1]))],
    minutes: [Number(m[2] ?? 0)],
  }));
}

function clockTimes(text: string): FoundTime[] {
  return [...text.matchAll(H24)].map((m) => ({ text: m[0], hours: [[Number(m[1])]], minutes: [Number(m[2])] }));
}

/** Every clock time in the text. */
export function findTimes(text: string): FoundTime[] {
  return [...englishTimes(text), ...hindiTimes(text), ...clockTimes(text), ...spokenTimes(text)];
}

/** The text with every clock time removed (for the leftover-number check). */
export function withoutTimes(text: string): string {
  return findTimes(text).reduce((out, t) => out.replace(t.text, " "), text);
}

/** An allowed time from the input: an hour and minute (24 h). */
export interface ClockTime {
  readonly hour: number;
  readonly minute: number;
}

/** True when every endpoint of the found time is one of the allowed times. */
export function isAllowedTime(found: FoundTime, allowed: readonly ClockTime[]): boolean {
  return found.hours.every((readings, i) => readings.some((h) => allowed.some((a) => a.hour === h && a.minute === found.minutes[i])));
}

/** True when one endpoint of the found time can be the given hour and minute. */
export const isTimeAt = (found: FoundTime, hour: number, minute = 0): boolean =>
  found.hours.some((readings, i) => readings.includes(hour) && found.minutes[i] === minute);

/** True when the text names the given hour (any format, minute 0 or the given minute). */
export const mentionsHour = (text: string, hour: number, minute = 0): boolean => findTimes(text).some((t) => isTimeAt(t, hour, minute));
