/**
 * Unicode-aware words. `\b` does not work for Devanagari (matras are marks, not word characters),
 * so words are runs of letters, marks and digits, and matching is done on whole words.
 */
const WORD = /[\p{L}\p{M}\p{N}]+/gu;

/** Lower-cases and NFC-normalises a word or name for matching. */
export const normaliseWord = (word: string): string => word.normalize("NFC").toLocaleLowerCase("en-IN").trim();

/** The text's words, normalised, in order. */
export function wordsOf(text: string): string[] {
  return (text.normalize("NFC").match(WORD) ?? []).map(normaliseWord);
}

/** True when `phrase` (one or more words) appears in `text` as whole words, ignoring case. */
export function containsPhrase(text: string, phrase: string): boolean {
  const target = wordsOf(phrase);
  if (!target.length) return false;
  const words = wordsOf(text);
  return words.some((_, i) => target.every((w, j) => words[i + j] === w));
}

/**
 * Replaces each whole-word occurrence of any of `phrases` with `replacement`, ignoring case.
 * Longer phrases are tried first, so "Dadaji" wins over "Dada".
 */
export function replacePhrases(text: string, phrases: readonly string[], replacement: string): string {
  const sorted = [...phrases].filter((p) => p.trim()).sort((a, b) => b.length - a.length);
  return sorted.reduce((out, phrase) => {
    const escaped = phrase.normalize("NFC").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escaped}(?![\\p{L}\\p{M}\\p{N}])`, "giu");
    return out.normalize("NFC").replace(pattern, replacement);
  }, text);
}
