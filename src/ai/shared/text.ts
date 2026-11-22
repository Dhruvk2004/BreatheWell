/**
 * Unicode helpers. Devanagari letters with a nukta (ड़, ज़, फ़) have two encodings, so every text
 * and every pattern is put into NFC before matching.
 */
export const nfc = (text: string): string => text.normalize("NFC");

/** A RegExp whose source is NFC-normalised (for patterns with Devanagari). */
export const nfcRegExp = (source: string, flags = "u"): RegExp => new RegExp(nfc(source), flags);

/** Splits text into sentences on . ! ? and the Devanagari danda. */
export const sentences = (text: string): string[] =>
  nfc(text)
    .split(/[.!?।]+/u)
    .map((s) => s.trim())
    .filter(Boolean);
