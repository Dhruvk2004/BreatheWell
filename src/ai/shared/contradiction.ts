import { containsPhrase } from "@/domain/names/words";
import type { Mode } from "@/domain/rules/modes";
import type { Suggestion } from "@/domain/rules/plan";
import type { Verdict } from "@/domain/rules/verdict";
import { normaliseNumbers } from "./normalise";
import { clauses, isCancelled } from "./skip";
import { findTimes, isTimeAt } from "./times";
import { nfc, sentences } from "./text";

/**
 * Concrete contradiction checks (spec 7.1, design G): the words may not disagree with the rules.
 * EN and HI word lists; a failing item falls back to its template text.
 */
export type ContradictionProblem =
  "missing_best_time" | "usual_time_without_skip" | "missing_switch_mode" | "go_word_on_avoid" | "avoid_word_on_go" | "time_on_indoor";

const GO = ["go", "walk", "play", "enjoy", "head out", "step out", "चलें", "जाएँ", "जाएं", "खेलें", "टहलें", "घूमें", "सैर करें"];
const TOMORROW = ["tomorrow", "कल"];
const AVOID = [
  "don't go",
  "do not go",
  "stay inside",
  "stay indoors",
  "stay in",
  "avoid going",
  "बाहर न जाएँ",
  "बाहर न जाएं",
  "घर में रहें",
  "अंदर रहें",
  "बाहर नहीं",
];

/** Words that name each travel mode (spec 7.1 `switch_mode`: doThis must contain the mode word). */
export const MODE_WORDS: Readonly<Record<Mode, readonly string[]>> = {
  metro: ["metro", "मेट्रो"],
  school_bus: ["school bus", "bus", "स्कूल बस", "बस"],
  carpool: ["carpool", "car pool", "share the car", "shared car", "कारपूल", "कार शेयर"],
  car: ["car", "कार", "गाड़ी"],
  auto_bus: ["auto", "bus", "ऑटो", "बस"],
  auto_van: ["auto", "van", "ऑटो", "वैन"],
  walk: ["walk", "on foot", "पैदल"],
  cycle: ["cycle", "bicycle", "साइकिल"],
  two_wheeler: ["scooter", "bike", "two-wheeler", "स्कूटर", "बाइक"],
  home: ["home", "घर"],
};

const has = (text: string, words: readonly string[]) => words.some((w) => containsPhrase(text, w));

/** The rule facts an item's text is checked against. */
export interface RuleFacts {
  readonly verdictAtUsual: Verdict;
  readonly suggestion: Suggestion;
  readonly usualHour: number;
  readonly usualMinute: number;
  readonly bestTime: number | null;
  readonly switchTo: Mode | null;
}

/** True when the sentence names the usual time and no skip phrase cancels it ("Walk at 6:30 am, no rush."). */
const keepsUsual = (sentence: string, rule: RuleFacts) =>
  clauses(sentence).some((c) => findTimes(c).some((t) => isTimeAt(t, rule.usualHour, rule.usualMinute) && !isCancelled(c, t)));

/**
 * Avoid at every hour today means no outdoor time today: a clause that names a time without a skip
 * phrase governing it, or "tomorrow", recommends one (design G: "दोपहर 3 बजे की सैर आपके लिए बेहतर है।"
 * is rejected).
 */
const recommendsTimeToday = (text: string) =>
  sentences(text).some((s) => clauses(s).some((c) => !has(c, TOMORROW) && findTimes(c).some((t) => !isCancelled(c, t))));

/** Every contradiction between an item's `doThis` and its rule result. */
export function contradictions(raw: string, rule: RuleFacts): ContradictionProblem[] {
  // "eight am", "आठ बजे" and "८ बजे" are times too (stage 7 AI-1).
  const text = normaliseNumbers(nfc(raw));
  const problems: ContradictionProblem[] = [];
  const usual = sentences(text).filter((s) => keepsUsual(s, rule));
  if (rule.suggestion === "move_time" && rule.bestTime !== null) {
    if (!findTimes(text).some((t) => t.hours.some((r) => r.includes(rule.bestTime as number)))) problems.push("missing_best_time");
    if (usual.length) problems.push("usual_time_without_skip");
  }
  if (rule.suggestion === "switch_mode" && rule.switchTo && !has(text, MODE_WORDS[rule.switchTo])) problems.push("missing_switch_mode");
  if (rule.verdictAtUsual === "avoid" && usual.some((s) => has(s, GO))) problems.push("go_word_on_avoid");
  if (rule.verdictAtUsual === "go" && rule.suggestion === "as_planned" && has(text, AVOID)) problems.push("avoid_word_on_go");
  if (rule.suggestion === "indoor" && recommendsTimeToday(text)) problems.push("time_on_indoor");
  return problems;
}
