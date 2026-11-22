import { wordsOf } from "@/domain/names/words";
import { findTimes, type FoundTime } from "./times";
import { nfc } from "./text";

/**
 * Does a skip phrase cancel a time? (spec 7.1 contradiction checks). A skip word anywhere in the
 * sentence is not enough ("Walk at 6:30 am, no worries." recommends 6:30): the phrase must govern
 * the time, in the same clause and close to it. English puts it before the time ("skip the 6:30
 * walk", "instead of 6:30 am", "not at 6:30"); Hindi after it ("6:30 बजे की सैर छोड़ें",
 * "6:30 बजे के बजाय", "6:30 बजे नहीं"). Both directions are tried for every language, so mixed
 * text is judged the same way. When in doubt the time counts as recommended: the item then falls
 * back to its template, which is always safe.
 */
interface Markers {
  /** Phrases that cancel a time up to 4 words away. */
  readonly strong: readonly string[];
  /** Bare negations, only right next to the time ("not outside at 6:30", "6:30 बजे नहीं"). */
  readonly weak: readonly string[];
  readonly weakGap: number;
}

const STRONG_GAP = 4;
const BEFORE: Markers = {
  strong: ["skip", "skipping", "avoid", "avoiding", "don't", "do not", "instead of", "rather than", "not at"],
  weak: ["not"],
  weakGap: 2,
};
const AFTER: Markers = {
  strong: ["छोड़ें", "छोड़", "छोड़ दें", "छोड़िए", "के बजाय", "बजाय", "की जगह", "टालें", "न जाएँ", "न जाएं", "न करें", "न निकलें"],
  weak: ["नहीं", "मत"],
  weakGap: 1,
};

/** Single-word "go" verbs: one of these between the phrase and the time starts a new instruction. */
const GO_VERBS = new Set(["go", "walk", "play", "enjoy", "jog", "run", "चलें", "जाएँ", "जाएं", "खेलें", "टहलें", "घूमें"]);
/** A go word after one of these is a noun ("skip the walk at 6:30"), not an instruction. */
const DETERMINERS = new Set(["the", "your", "a", "this", "that", "my", "usual", "morning", "evening", "की", "अपनी"]);

const CLAUSE_BREAK = /[,;]|:\s|\s[-–—]\s/u;

/** A sentence's clauses: a comma, semicolon, colon or spaced dash starts a new one. */
export const clauses = (sentence: string): string[] =>
  nfc(sentence)
    .split(CLAUSE_BREAK)
    .map((c) => c.trim())
    .filter(Boolean);

/** Start indexes where `phrase` (as words) occurs in `words`. */
function phraseStarts(words: readonly string[], phrase: string): { start: number; end: number }[] {
  const target = wordsOf(phrase);
  return words.flatMap((_, i) => (target.every((w, j) => words[i + j] === w) ? [{ start: i, end: i + target.length - 1 }] : []));
}

/** True when a go verb in words[from, to) is a fresh instruction (not a noun after a determiner). */
function breaksAt(words: readonly string[], from: number, to: number): boolean {
  for (let i = from; i < to; i++) if (GO_VERBS.has(words[i]) && !DETERMINERS.has(words[i - 1] ?? "")) return true;
  return false;
}

/** A marker before the time: `words` are the clause words before it, nearest last. */
function governsFromBefore(words: readonly string[]): boolean {
  const tryList = (list: readonly string[], gap: number) =>
    list.some((m) => phraseStarts(words, m).some(({ end }) => words.length - end - 1 <= gap && !breaksAt(words, end + 2, words.length)));
  return tryList(BEFORE.strong, STRONG_GAP) || tryList(BEFORE.weak, BEFORE.weakGap);
}

/** A marker after the time: `words` are the clause words after it, nearest first. */
function governsFromAfter(words: readonly string[]): boolean {
  const tryList = (list: readonly string[], gap: number) =>
    list.some((m) => phraseStarts(words, m).some(({ start }) => start <= gap && !breaksAt(words, 0, start - 1)));
  return tryList(AFTER.strong, STRONG_GAP) || tryList(AFTER.weak, AFTER.weakGap);
}

/** The clause text on each side of a time, stopping at any other time. */
function sides(clause: string, time: FoundTime): { before: string; after: string } {
  const at = clause.indexOf(time.text);
  const before = clause.slice(0, at);
  const after = clause.slice(at + time.text.length);
  const lastBefore = findTimes(before).at(-1);
  const firstAfter = findTimes(after)[0];
  return {
    before: lastBefore ? before.slice(before.lastIndexOf(lastBefore.text) + lastBefore.text.length) : before,
    after: firstAfter ? after.slice(0, after.indexOf(firstAfter.text)) : after,
  };
}

/** True when a skip phrase in the clause governs this time ("skip the 6:30 walk"). */
export function isCancelled(clause: string, time: FoundTime): boolean {
  const { before, after } = sides(clause, time);
  return governsFromBefore(wordsOf(before)) || governsFromAfter(wordsOf(after));
}
