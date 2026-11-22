import type { Lang } from "@/domain/time/format";

/** Tokens that are fine in either script: N95, PM2.5/PM10, placeholders like {m1}. */
const NEUTRAL = /\bN-?95\b|\bPM\s?(?:2\.5|10)\b|\{[md]\d+\}/giu;

/** The share of letters (vowel signs included) that are Devanagari (0–1); 1 for a text with no letters. */
export function devanagariShare(text: string): number {
  const letters = text.replace(NEUTRAL, " ").match(/[\p{L}\p{M}]/gu) ?? [];
  if (!letters.length) return 1;
  return letters.filter((l) => /\p{Script=Devanagari}/u.test(l)).length / letters.length;
}

/** `hi` fields need at least 60% Devanagari letters (spec 7.1). */
export const MIN_HINDI_SHARE = 0.6;
/** `en` fields are Latin: at most 10% Devanagari letters. */
export const MAX_HINDI_IN_ENGLISH = 0.1;

/** True when the text is written in the field's language. */
export function inLanguage(text: string, lang: Lang): boolean {
  const share = devanagariShare(text);
  if (lang === "hi") return share >= MIN_HINDI_SHARE;
  const hasLetters = /\p{L}/u.test(text.replace(NEUTRAL, " "));
  return !hasLetters || share <= MAX_HINDI_IN_ENGLISH;
}
