import { normaliseNumbers } from "./normalise";
import { findTimes, isAllowedTime, withoutTimes, type ClockTime } from "./times";

/**
 * "No air numbers, without false alarms". After normalising digits and number words,
 * only these number tokens may stay: N95; PM2.5 / PM10 when not followed by a number; 112; the
 * fixed durations (5, 10, 15, 30 minutes; 1 hour); the input's allowed times; small counts ≤ 10.
 * Air numbers are slotted in by code, so anything else is a leak.
 */
export type NumberProblem = "number_leak" | "air_unit" | "time_not_allowed";

const PLACEHOLDER = /\{[md]\d+\}/gu;
const N95 = /\bN-?95\b/giu;
const PM_NAME = /\bPM\s?(?:2\.5|10)\b(?!\s*[:=]?\s*\d)/giu;
const EMERGENCY = /(?<![\d.])112(?![\d.])/gu;
const DURATION = /(?<![\d.])(?:5|10|15|30)\s*(?:minutes?|mins?|मिनट)(?![\p{L}])|(?<![\d.])1\s*(?:hour|घंटा|घंटे)(?![\p{L}])/giu;
const PERCENT = /\d\s*(?:%|percent|प्रतिशत)/iu;
const UNIT_NEAR_NUMBER =
  /(?:\baqi\b|एक्यूआई|µg|μg|ug\/m|माइक्रोग्राम)\s*(?:of|is|was|:|=|का|है)?\s*\d|\d\s*(?:µg|μg|ug|माइक्रोग्राम|\baqi\b)/iu;
const SMALL_COUNT = /(?<![\d.:])(?:10|[0-9])(?![\d.:%])/gu;

/** Problems with the numbers in one text field. */
export function numberProblems(text: string, allowedTimes: readonly ClockTime[]): NumberProblem[] {
  const normal = normaliseNumbers(text).replace(PLACEHOLDER, " ");
  const problems = new Set<NumberProblem>();
  if (UNIT_NEAR_NUMBER.test(normal)) problems.add("air_unit");
  if (PERCENT.test(normal)) problems.add("number_leak");
  if (findTimes(normal).some((t) => !isAllowedTime(t, allowedTimes))) problems.add("time_not_allowed");
  const rest = withoutTimes(normal)
    .replace(N95, " ")
    .replace(PM_NAME, " ")
    .replace(EMERGENCY, " ")
    .replace(DURATION, " ")
    .replace(SMALL_COUNT, " ");
  if (/\d/.test(rest)) problems.add("number_leak");
  return [...problems];
}
