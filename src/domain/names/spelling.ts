import { normaliseWord } from "./words";

/**
 * Near spellings of a stored name (stage 7 PT-2): "Rameshji" and "रमेशजी" carry an honorific, and
 * "Riyaa" or "Riyu" are one letter away from "Riya". Each is still that person's name, so it is
 * swapped for the token before anything reaches Gemini.
 */
const HONORIFIC = /(?:ji|jee|जी)$/iu;
const LATIN = /^[a-z]+$/u;
const MIN_FUZZY = 4;

/** The word without an honorific suffix, when at least 3 letters remain ("Rameshji" → "Ramesh"). */
export function withoutHonorific(word: string): string {
  const stem = word.normalize("NFC").replace(HONORIFIC, "");
  return stem !== word.normalize("NFC") && [...stem].length >= 3 ? stem : word;
}

const VOWELS = new Set("aeiouy");

/**
 * True when `a` becomes `b` by one insertion or deletion, or one vowel for another ("Riyu", "Riyaa"
 * for "Riya"; not "Rita", which is another name).
 */
function oneEditApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const tail = (x: string, skip: number) => x.slice(i + skip);
  if (a.length === b.length) return a === b || (VOWELS.has(a[i]) && VOWELS.has(b[i]) && tail(a, 1) === tail(b, 1));
  return a.length > b.length ? tail(a, 1) === tail(b, 0) : tail(a, 0) === tail(b, 1);
}

/**
 * True when a Latin word of 4+ letters is a one-letter (or one-vowel) misspelling of a Latin name of 4+ letters
 * with the same first letter ("Riyaa", "Riyu" for "Riya").
 */
export function nearSpelling(word: string, name: string): boolean {
  const [w, n] = [normaliseWord(word), normaliseWord(name)];
  if (!LATIN.test(w) || !LATIN.test(n) || w.length < MIN_FUZZY || n.length < MIN_FUZZY) return false;
  return w[0] === n[0] && oneEditApart(w, n);
}
