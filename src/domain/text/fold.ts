/**
 * Folds typed text to the plain form every safety check matches on:
 * NFKC (fullwidth "ｃａｎｔ" → "cant"), format characters deleted rather than turned into spaces
 * (zero-width space and joiners, soft hyphen, bidi marks), and Cyrillic and Greek look-alikes
 * mapped to Latin ("Rіya" with a Cyrillic і → "Riya"). BreatheWell is English and Hindi only, so
 * those letters are never meant as themselves.
 */
const LOOKALIKES: Readonly<Record<string, string>> = {
  а: "a",
  в: "b",
  е: "e",
  ё: "e",
  к: "k",
  м: "m",
  н: "h",
  о: "o",
  р: "p",
  с: "c",
  т: "t",
  у: "y",
  х: "x",
  і: "i",
  ї: "i",
  ј: "j",
  ѕ: "s",
  ԁ: "d",
  һ: "h",
  α: "a",
  β: "b",
  ε: "e",
  ι: "i",
  κ: "k",
  ν: "v",
  ο: "o",
  ρ: "p",
  τ: "t",
  υ: "u",
  χ: "x",
};

const FORMAT = /\p{Cf}/gu;
const GREEK_OR_CYRILLIC = /[Ͱ-ϿЀ-ԯ]/gu;

/** Maps one Greek or Cyrillic letter to its Latin look-alike, keeping its case. */
function latinFor(letter: string): string {
  const lower = letter.toLowerCase();
  const latin = LOOKALIKES[lower];
  if (!latin) return letter;
  return letter === lower ? latin : latin.toUpperCase();
}

/** NFKC, no format characters, Latin look-alikes; then NFC for matching. */
export function foldText(text: string): string {
  return text.normalize("NFKC").replace(FORMAT, "").replace(GREEK_OR_CYRILLIC, latinFor).normalize("NFC");
}
