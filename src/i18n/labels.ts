import type { Band } from "@/domain/air/bands";
import type { ActivityType } from "@/domain/rules/activities";
import type { Mode } from "@/domain/rules/modes";
import type { PlanNote, Suggestion } from "@/domain/rules/plan";
import type { Verdict } from "@/domain/rules/verdict";
import type { Weekday } from "@/domain/time/clock";
import type { MessageKey } from "./t";

/*
 * Message keys for the rule enums. `satisfies MessageKey` makes a missing key in en.json a type
 * error, and the i18n test checks hi.json has the same keys, so a new note, suggestion, mode or
 * activity cannot ship without its English and Hindi words.
 */

/** "note.keep_inhaler" → "Keep inhaler or medicines with you." */
export const noteKey = (note: PlanNote) => `note.${note}` satisfies MessageKey;

/** "suggestion.move_time" → "Move to a better time". */
export const suggestionKey = (suggestion: Suggestion) => `suggestion.${suggestion}` satisfies MessageKey;

/** "mode.auto_bus" → "Auto or bus". */
export const modeKey = (mode: Mode) => `mode.${mode}` satisfies MessageKey;

/** "activity.morning_walk" → "Morning walk or yoga". */
export const activityKey = (type: ActivityType) => `activity.${type}` satisfies MessageKey;

/** "band.very_poor.word" → "Very poor". */
export const bandWordKey = (band: Band) => `band.${band}.word` satisfies MessageKey;

/** "band.very_poor.plain" → "Very unhealthy". */
export const bandPlainKey = (band: Band) => `band.${band}.plain` satisfies MessageKey;

/** "verdict.care" → "Go with care". */
export const verdictKey = (verdict: Verdict) => `verdict.${verdict}` satisfies MessageKey;

/** "weekday.fri" → "Fri". */
export const weekdayKey = (day: Weekday) => `weekday.${day}` satisfies MessageKey;
