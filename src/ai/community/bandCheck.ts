import { bandRank } from "@/domain/air/bands";
import { containsPhrase } from "@/domain/names/words";
import { normaliseNumbers } from "../shared/normalise";
import { activityIn } from "../shared/outing";
import { nfc, sentences } from "../shared/text";
import { findTimes } from "../shared/times";
import type { CommunityPromptInput } from "./schema";

/**
 * The community message must agree with the band and the best window from code (spec 7.1, 7.6):
 * on a Poor or worse day, a sentence that sends people out ("walks are fine today") must name a time
 * inside the best window, or be a "stay in / skip it" sentence. So the body can never invite people
 * out at another hour than the header's best time, or at all on a day with no window.
 */
const HOLD_BACK = [
  "indoors",
  "inside",
  "skip",
  "avoid",
  "don't",
  "do not",
  "not",
  "instead",
  "wait",
  "अंदर",
  "घर में",
  "न",
  "नहीं",
  "मत",
  "छोड़ें",
  "टालें",
  "बजाय",
];

/** The best window's hours, start inclusive and end exclusive, from "14:00-16:00". */
function windowOf(best: string | null): { start: number; end: number } | null {
  const match = best?.match(/^(\d{2}):00-(\d{2}):00$/u);
  return match ? { start: Number(match[1]), end: Number(match[2]) } : null;
}

const inWindow = (hours: readonly number[], w: { start: number; end: number } | null): boolean =>
  w !== null && hours.some((h) => h >= w.start && h < w.end);

/** True when the sentence sends people out at a time (or no time) the band and window do not allow. */
function sentenceBad(sentence: string, best: { start: number; end: number } | null): boolean {
  if (!activityIn(sentence) || HOLD_BACK.some((w) => containsPhrase(sentence, w))) return false;
  const times = findTimes(sentence);
  return times.length === 0 || !times.every((t) => inWindow(t.hours[0], best));
}

/** True when the text agrees with the band and best window (always true below Poor). */
export function agreesWithBand(text: string, input: Pick<CommunityPromptInput, "band" | "bestWindow">): boolean {
  if (bandRank(input.band) < bandRank("poor")) return true;
  const best = windowOf(input.bestWindow);
  return !sentences(normaliseNumbers(nfc(text))).some((s) => sentenceBad(s, best));
}
